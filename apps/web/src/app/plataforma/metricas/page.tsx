'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import {
  PERMISOS,
  hasPermission,
  type MetricasPlataforma,
  type OrgContext,
} from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Input } from '@/components/ui/input';

function tasaPct(cadena: string): string {
  const n = Number(cadena);
  if (!Number.isFinite(n)) return '0 %';
  return `${(n * 100).toFixed(1)} %`;
}

function formatearDuracion(ms: number | null): string {
  if (ms == null) return 'Sin datos';
  const minutos = Math.round(ms / 60_000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export default function PlataformaMetricasPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState<MetricasPlataforma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ detalle: 'true' });
      if (desde) params.set('desde', new Date(`${desde}T00:00:00.000Z`).toISOString());
      if (hasta) params.set('hasta', new Date(`${hasta}T23:59:59.999Z`).toISOString());
      const result = await apiFetch<MetricasPlataforma>(
        `/plataforma/metricas?${params.toString()}`,
      );
      setData(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setError('No tiene permiso para ver métricas de plataforma.');
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
        if (perfil.contexto.ambito !== 'PLATAFORMA') {
          router.replace('/panel');
          return;
        }
        if (
          !hasPermission(perfil.contexto, PERMISOS.PLATAFORMA_METRICAS_VER)
        ) {
          setError('No tiene permiso para ver métricas de plataforma.');
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

  function aplicar(e: FormEvent) {
    e.preventDefault();
    void cargar();
  }

  return (
    <AppShell nav="plataforma" maxWidth="lg">
      <BackLink href="/panel">Volver al panel</BackLink>
      <PageHeader
        title="Métricas de plataforma"
        description="Agregados entre organizaciones. Sin clientes, folios ni textos de solicitud."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      <form
        onSubmit={aplicar}
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
      </form>

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-muted">Cargando…</p>
      ) : data ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Organizaciones activas',
                value: String(data.organizacionesActivas),
              },
              {
                label: 'Cotizaciones',
                value: String(data.cotizacionesTotales),
              },
              {
                label: 'Tasa aprobación',
                value: tasaPct(data.tasaAprobacionGlobal),
              },
              {
                label: 'Tiempo mediano global',
                value: formatearDuracion(data.tiempoMedianoGlobalMs),
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-borde/80 bg-surface px-4 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {c.label}
                </p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">
                  {c.value}
                </p>
              </div>
            ))}
          </section>

          <p className="text-sm text-muted">
            Aprobadas: {data.aprobadasTotales} · Ganadas: {data.ganadasTotales}{' '}
            · Perdidas: {data.perdidasTotales}
          </p>

          {data.porOrganizacion?.length ? (
            <section className="rounded-2xl border border-borde/80 bg-surface p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Building2 className="size-4 text-teal" />
                Por organización
              </h2>
              <ul className="mt-3 space-y-2">
                {data.porOrganizacion.map((o) => (
                  <li
                    key={o.organizacionId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper/80 px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-ink">{o.nombre}</span>
                    <span className="text-muted">
                      {o.cotizaciones} cot. · {o.aprobadas} apr. · {o.ganadas}{' '}
                      gan. · {o.perdidas} perd.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
