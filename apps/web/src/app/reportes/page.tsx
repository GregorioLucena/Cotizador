'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import {
  PERMISOS,
  hasPermission,
  type CotizacionesResumen,
  type DesempenoReconocimiento,
  type OrgContext,
  type TerminoFallido,
} from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  AppShell,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Input } from '@/components/ui/input';
import { etiquetaEstadoCotizacion } from '@/lib/cotizaciones';

function formatearDuracion(ms: number | null): string {
  if (ms == null) return 'Sin datos';
  const minutos = Math.round(ms / 60_000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function tasaPct(cadena: string): string {
  const n = Number(cadena);
  if (!Number.isFinite(n)) return '0 %';
  return `${(n * 100).toFixed(1)} %`;
}

export default function ReportesPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resumen, setResumen] = useState<CotizacionesResumen | null>(null);
  const [desempeno, setDesempeno] = useState<DesempenoReconocimiento | null>(
    null,
  );
  const [terminos, setTerminos] = useState<TerminoFallido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const puedeCurar =
    contexto && hasPermission(contexto, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', new Date(`${desde}T00:00:00.000Z`).toISOString());
      if (hasta) params.set('hasta', new Date(`${hasta}T23:59:59.999Z`).toISOString());
      const q = params.toString() ? `?${params.toString()}` : '';

      const [r, d, t] = await Promise.all([
        apiFetch<CotizacionesResumen>(`/reportes/cotizaciones-resumen${q}`),
        apiFetch<DesempenoReconocimiento>(
          `/reportes/desempeno-reconocimiento${q}`,
        ),
        apiFetch<TerminoFallido[]>(`/reportes/terminos-fallidos${q}`),
      ]);
      setResumen(r);
      setDesempeno(d);
      setTerminos(t);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo cargar.',
      );
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, router]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.REPORTES_VER)) {
          setError('No tiene permiso para ver reportes.');
          setLoading(false);
          return;
        }
        setContexto(perfil.contexto);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error');
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!contexto) return;
    void cargar();
  }, [contexto, cargar]);

  function aplicarPeriodo(e: FormEvent) {
    e.preventDefault();
    void cargar();
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        title="Métricas del piloto"
        description="Cómo anda el mostrador: cantidad, tiempos, reconocimiento y conversión."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      <form
        onSubmit={aplicarPeriodo}
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Desde
          </span>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Hasta
          </span>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal px-4 text-sm font-bold text-white hover:bg-teal-deep"
        >
          Actualizar
        </button>
        <p className="w-full text-xs text-muted">
          Sin fechas: últimos 30 días de la organización.
        </p>
      </form>

      {loading && !resumen ? (
        <p className="py-12 text-center text-sm text-muted">Calculando…</p>
      ) : resumen && desempeno ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Tiempo mediano captura → aprobación',
                value: formatearDuracion(
                  resumen.tiempoMedianoCapturaAprobacionMs,
                ),
                hint:
                  resumen.tiempoMedianoCapturaAprobacionMs != null
                    ? `${resumen.tiempoMedianoCapturaAprobacionMs} ms`
                    : undefined,
              },
              {
                label: 'Conversión (ganadas / resultado)',
                value: tasaPct(resumen.conversion),
              },
              {
                label: 'Monto ganado',
                value: resumen.montoGanado,
              },
              {
                label: 'Monto perdido',
                value: resumen.montoPerdido,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-borde/80 bg-surface px-4 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {card.label}
                </p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">
                  {card.value}
                </p>
                {card.hint ? (
                  <p className="mt-1 text-xs text-muted">{card.hint}</p>
                ) : null}
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-borde/80 bg-surface p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <BarChart3 className="size-4 text-teal" />
              Cantidad por estado
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(resumen.cantidadPorEstado).map(([estado, n]) => (
                <li
                  key={estado}
                  className="flex items-center justify-between rounded-xl bg-paper/80 px-3 py-2 text-sm"
                >
                  <span>{etiquetaEstadoCotizacion(estado)}</span>
                  <span className="font-bold tabular-nums text-ink">{n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Monto total aprobado (cadena base): {resumen.montoTotalAprobado}
              {resumen.vencidasPendientesDeMarca > 0
                ? ` · ${resumen.vencidasPendientesDeMarca} enviada(s) vencida(s) aún sin marcar`
                : ''}
            </p>
          </section>

          <section className="rounded-2xl border border-borde/80 bg-surface p-4">
            <h2 className="text-sm font-bold text-ink">
              Desempeño de reconocimiento
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  Tasa automáticas
                </dt>
                <dd className="font-display text-xl font-bold text-ink">
                  {tasaPct(desempeno.tasaAutomaticas)}
                </dd>
                <dd className="text-xs text-muted">
                  {desempeno.lineasAutomaticas} de {desempeno.lineasTotales}{' '}
                  líneas
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  Tasa corrección
                </dt>
                <dd className="font-display text-xl font-bold text-ink">
                  {tasaPct(desempeno.tasaCorreccion)}
                </dd>
                <dd className="text-xs text-muted">
                  {desempeno.eventosCorreccion} eventos LINEA_CORREGIDA
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-borde/80 bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-ink">Términos fallidos</h2>
              {puedeCurar ? (
                <Link
                  href="/catalogo/terminos"
                  className="text-sm font-semibold text-teal underline"
                >
                  Ir a curación
                </Link>
              ) : null}
            </div>
            {!terminos.length ? (
              <p className="mt-3 text-sm text-muted">
                Sin términos fallidos en el periodo.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {terminos.map((t) => (
                  <li
                    key={t.textoNormalizado}
                    className="flex items-start justify-between gap-3 rounded-xl bg-paper/80 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-semibold text-ink">
                        {t.ejemploOriginal}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t.textoNormalizado}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-teal">
                      ×{t.vecesVisto}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
