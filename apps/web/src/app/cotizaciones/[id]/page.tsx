'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  etiquetaResolucion,
  type CotizacionDetalle,
  type EstadoResolucion,
  type PrecotizacionResultado,
} from '@/lib/cotizaciones';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

function SemaforoDot({ estado }: { estado: EstadoResolucion }) {
  const { tone } = etiquetaResolucion(estado);
  const color =
    tone === 'success'
      ? 'bg-exito'
      : tone === 'warn'
        ? 'bg-ambar'
        : tone === 'danger'
          ? 'bg-peligro'
          : 'bg-muted';
  return (
    <span
      className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', color)}
      aria-hidden
    />
  );
}

export default function CotizacionDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null);
  const [interpretacion, setInterpretacion] = useState<
    PrecotizacionResultado['interpretacion'] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocesando, setReprocesando] = useState(false);
  const [avisoIa, setAvisoIa] = useState<string | null>(null);

  const puedeCrear =
    contexto && hasPermission(contexto, PERMISOS.COTIZACIONES_CREAR);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado>(`/cotizaciones/${id}`);
      setCotizacion(data.cotizacion);
      setInterpretacion(data.interpretacion);
      if (!data.interpretacion?.exito && data.cotizacion.lineas.length === 0) {
        setAvisoIa(
          (prev) =>
            prev ??
            'No se pudo interpretar el mensaje. Puedes armar la cotización a mano.',
        );
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo cargar el borrador.',
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
        if (perfil.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        if (!hasPermission(perfil.contexto, PERMISOS.COTIZACIONES_VER)) {
          setError('No tiene permiso para ver cotizaciones.');
          setLoading(false);
          return;
        }
        setContexto(perfil.contexto);
        await cargar();
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'No se pudo cargar.',
        );
        setLoading(false);
      }
    })();
  }, [cargar, router]);

  // Leer flag de sesión si venimos de captura con IA fallida (opcional vía query)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem(`cot_aviso_ia_${id}`);
    if (flag) {
      setAvisoIa(flag);
      sessionStorage.removeItem(`cot_aviso_ia_${id}`);
    }
  }, [id]);

  async function reprocesar() {
    if (!cotizacion?.solicitudId || !puedeCrear) return;
    const ok = window.confirm(
      'Se creará un borrador nuevo con una interpretación nueva. El borrador actual no se borra. ¿Continuar?',
    );
    if (!ok) return;
    setReprocesando(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado>(
        `/precotizaciones/${cotizacion.solicitudId}/reprocesar`,
        {
          method: 'POST',
          body: JSON.stringify({
            listaPrecioId: cotizacion.listaPrecioId,
            sucursalId: cotizacion.sucursalId,
          }),
        },
      );
      if (data.interpretacion && !data.interpretacion.exito) {
        sessionStorage.setItem(
          `cot_aviso_ia_${data.cotizacion.id}`,
          'No se pudo interpretar el mensaje. Puedes armar la cotización a mano.',
        );
      }
      router.push(`/cotizaciones/${data.cotizacion.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo reprocesar.',
      );
      setReprocesando(false);
    }
  }

  const resumen = cotizacion
    ? {
        resueltas: cotizacion.lineas.filter(
          (l) =>
            l.estadoResolucion === 'RESUELTA_AUTOMATICA' ||
            l.estadoResolucion === 'RESUELTA_MANUAL',
        ).length,
        sugeridas: cotizacion.lineas.filter(
          (l) => l.estadoResolucion === 'SUGERIDA_REVISAR',
        ).length,
        sinMatch: cotizacion.lineas.filter(
          (l) => l.estadoResolucion === 'NO_ENCONTRADA',
        ).length,
      }
    : null;

  if (loading) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <p className="py-20 text-center text-sm text-muted">Cargando borrador…</p>
      </AppShell>
    );
  }

  if (error && !cotizacion) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <BackLink href="/cotizar">← Cotizar</BackLink>
        <div className="mt-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      </AppShell>
    );
  }

  if (!cotizacion) return null;

  const clienteLabel =
    cotizacion.nombreClienteLibre ??
    (cotizacion.clienteId ? 'Cliente registrado' : 'Sin cliente');

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        eyebrow={<BackLink href="/cotizar">← Nueva captura</BackLink>}
        title={cotizacion.folio}
        description={`${clienteLabel} · ${cotizacion.estado}`}
        action={
          puedeCrear && cotizacion.solicitudId ? (
            <Button
              variant="secondary"
              onClick={() => void reprocesar()}
              disabled={reprocesando}
              className="shrink-0"
            >
              <RefreshCw
                className={cn('size-4', reprocesando && 'animate-spin')}
                aria-hidden
              />
              Reprocesar
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      )}

      {(avisoIa || cotizacion.lineas.length === 0) && (
        <div className="mb-4">
          <StatusBanner tone="warn">
            {avisoIa ??
              'No se pudo interpretar el mensaje. Puedes armar la cotización a mano.'}{' '}
            <Link href="/cotizar" className="font-semibold underline">
              Nueva captura
            </Link>
            {' · '}
            <span className="text-slate">
              Agregar líneas manuales estará en la revisión (próximo módulo).
            </span>
          </StatusBanner>
        </div>
      )}

      {/* Resumen semáforo */}
      {resumen && (
        <section className="animate-rise mb-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-borde bg-surface px-3 py-3 text-center">
            <p className="font-display text-2xl font-bold text-exito">
              {resumen.resueltas}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Resueltas
            </p>
          </div>
          <div className="rounded-xl border border-borde bg-surface px-3 py-3 text-center">
            <p className="font-display text-2xl font-bold text-ambar">
              {resumen.sugeridas}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Revisar
            </p>
          </div>
          <div className="rounded-xl border border-borde bg-surface px-3 py-3 text-center">
            <p className="font-display text-2xl font-bold text-peligro">
              {resumen.sinMatch}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Sin match
            </p>
          </div>
        </section>
      )}

      {/* Totales */}
      <section className="animate-rise-delay mb-5 overflow-hidden rounded-2xl border border-borde bg-teal text-white">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
              Total borrador
            </p>
            <p className="font-display text-3xl font-bold tracking-tight">
              {cotizacion.total}
            </p>
          </div>
          <div className="text-right text-sm text-white/80">
            <p>Subtotal {cotizacion.subtotal}</p>
            {cotizacion.totalPresentacion && (
              <p className="mt-0.5">Presentación {cotizacion.totalPresentacion}</p>
            )}
          </div>
        </div>
      </section>

      {/* Líneas */}
      <section className="animate-rise-late space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Líneas
        </h2>
        {cotizacion.lineas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-borde bg-surface px-4 py-8 text-center text-sm text-muted">
            Borrador vacío. Sin líneas interpretadas.
          </p>
        ) : (
          cotizacion.lineas.map((linea) => {
            const meta = etiquetaResolucion(linea.estadoResolucion);
            return (
              <article
                key={linea.id}
                className="flex gap-3 rounded-xl border border-borde bg-surface px-3.5 py-3.5"
              >
                <SemaforoDot estado={linea.estadoResolucion} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">
                      {linea.descripcion ?? linea.textoSolicitado}
                    </p>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    Pediste: {linea.textoSolicitado}
                    {linea.sku ? ` · ${linea.sku}` : ''}
                  </p>
                  <p className="text-sm tabular-nums text-slate">
                    {linea.cantidad}
                    {linea.precioUnitario
                      ? ` · ${linea.precioUnitario}`
                      : ' · sin precio'}
                    {linea.total ? ` · tot ${linea.total}` : ''}
                  </p>
                  {linea.candidatos.length > 0 &&
                    linea.estadoResolucion === 'SUGERIDA_REVISAR' && (
                      <ul className="mt-2 space-y-1 rounded-lg bg-paper/90 px-2.5 py-2 text-xs">
                        <li className="font-semibold uppercase tracking-wide text-muted">
                          Candidatos
                        </li>
                        {linea.candidatos.map((c) => (
                          <li
                            key={`${c.itemId}-${c.orden}`}
                            className="flex justify-between gap-2 text-slate"
                          >
                            <span className="truncate">
                              {c.orden}. {c.nombre ?? c.itemId.slice(0, 8)}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted">
                              {c.puntaje}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  {linea.estadoResolucion === 'NO_ENCONTRADA' && (
                    <p className="text-xs text-peligro">
                      Alimenta términos no resueltos ·{' '}
                      <Link
                        href="/catalogo/terminos"
                        className="font-semibold underline"
                      >
                        Ver términos
                      </Link>
                    </p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      {interpretacion && (
        <details className="mt-6 rounded-xl border border-borde bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate">
            Traza de interpretación
          </summary>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted">Proveedor</dt>
              <dd className="font-semibold text-ink">{interpretacion.proveedor}</dd>
            </div>
            <div>
              <dt className="text-muted">Modelo</dt>
              <dd className="font-semibold text-ink">{interpretacion.modelo}</dd>
            </div>
            <div>
              <dt className="text-muted">Prompt</dt>
              <dd className="font-semibold text-ink">{interpretacion.versionPrompt}</dd>
            </div>
            <div>
              <dt className="text-muted">Latencia</dt>
              <dd className="font-semibold text-ink">{interpretacion.latenciaMs} ms</dd>
            </div>
            {interpretacion.errorCodigo && (
              <div className="sm:col-span-2">
                <dt className="text-muted">Código</dt>
                <dd className="font-semibold text-peligro">{interpretacion.errorCodigo}</dd>
              </div>
            )}
          </dl>
        </details>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        La edición y aprobación del borrador llegan en el siguiente módulo.
      </p>
    </AppShell>
  );
}
