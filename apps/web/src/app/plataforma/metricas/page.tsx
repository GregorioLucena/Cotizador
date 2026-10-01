'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Coins,
  LayoutDashboard,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  ESTADOS_COTIZACION,
  PERMISOS,
  hasPermission,
  type CantidadPorEstado,
  type ConsumoIaAgregado,
  type EstadoCotizacionCodigo,
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
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { etiquetaEstadoCotizacion } from '@/lib/cotizaciones';

type Vista = 'general' | 'organizaciones';

/**
 * Paleta de pipeline: un matiz por estado para no confundir
 * borrador/aprobada/enviada (antes eran grises y teals vecinos).
 */
const COLOR_ESTADO: Record<EstadoCotizacionCodigo, string> = {
  BORRADOR: '#8b9a96',
  APROBADA: '#0b5f56',
  ENVIADA: '#1d6fe8',
  GANADA: '#1f8a4c',
  PERDIDA: '#d64545',
  VENCIDA: '#e09a12',
  ANULADA: '#3f4f4b',
};

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

function formatearCostoUsd(valor: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '$0.00';
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function formatearEntero(n: number): string {
  return n.toLocaleString('es-VE');
}

function totalEstados(porEstado: CantidadPorEstado): number {
  return ESTADOS_COTIZACION.reduce((acc, e) => acc + (porEstado[e] ?? 0), 0);
}

function BarraEstados({
  porEstado,
  className,
}: {
  porEstado: CantidadPorEstado;
  className?: string;
}) {
  const total = totalEstados(porEstado);
  const segmentos = ESTADOS_COTIZACION.filter((e) => (porEstado[e] ?? 0) > 0);

  if (total === 0 || segmentos.length === 0) {
    return (
      <div
        className={cn(
          'h-4 w-full rounded-full bg-borde/40 ring-1 ring-inset ring-borde/60',
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn('flex h-4 w-full gap-1', className)}
      role="img"
      aria-label={segmentos
        .map(
          (e) =>
            `${etiquetaEstadoCotizacion(e)}: ${porEstado[e]} (${Math.round(((porEstado[e] ?? 0) / total) * 100)}%)`,
        )
        .join(', ')}
    >
      {segmentos.map((estado) => {
        const n = porEstado[estado] ?? 0;
        return (
          <span
            key={estado}
            title={`${etiquetaEstadoCotizacion(estado)}: ${n}`}
            className="relative h-full min-w-[8px] overflow-hidden rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[flex-grow] duration-500"
            style={{
              flexGrow: n,
              background: `linear-gradient(180deg, color-mix(in srgb, ${COLOR_ESTADO[estado]} 88%, white) 0%, ${COLOR_ESTADO[estado]} 100%)`,
            }}
          />
        );
      })}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4 transition duration-300',
        accent
          ? 'border-teal/25 bg-gradient-to-br from-teal to-teal-deep text-white shadow-[0_18px_40px_-24px_rgba(11,95,86,0.7)] hover:-translate-y-0.5'
          : 'border-borde/80 bg-surface hover:-translate-y-0.5 hover:border-teal/25 hover:shadow-[0_16px_32px_-28px_rgba(18,32,30,0.45)]',
      )}
    >
      <p
        className={cn(
          'text-[0.65rem] font-semibold uppercase tracking-[0.14em]',
          accent ? 'text-white/70' : 'text-muted',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
          accent ? 'text-white' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            'mt-1 text-xs',
            accent ? 'text-white/65' : 'text-muted',
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function LeyendaEstados({ porEstado }: { porEstado: CantidadPorEstado }) {
  const total = totalEstados(porEstado);
  const max = Math.max(...ESTADOS_COTIZACION.map((e) => porEstado[e] ?? 0), 1);

  return (
    <ul className="mt-5 space-y-2.5">
      {ESTADOS_COTIZACION.map((estado) => {
        const n = porEstado[estado] ?? 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const activo = n > 0;
        const color = COLOR_ESTADO[estado];

        return (
          <li
            key={estado}
            className={cn(
              'grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition',
              activo
                ? 'bg-paper/90 ring-1 ring-borde/70'
                : 'bg-transparent opacity-45',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                style={{
                  backgroundColor: color,
                  boxShadow: activo ? `0 0 0 3px color-mix(in srgb, ${color} 28%, transparent)` : undefined,
                }}
              />
              <span
                className={cn(
                  'truncate text-sm font-semibold',
                  activo ? 'text-ink' : 'text-muted',
                )}
              >
                {etiquetaEstadoCotizacion(estado)}
              </span>
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-borde/45">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${(n / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="min-w-[4.5rem] text-right text-sm tabular-nums">
              <span className={cn('font-bold', activo ? 'text-ink' : 'text-muted')}>
                {formatearEntero(n)}
              </span>
              <span className="ml-1 text-xs text-muted">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function BloqueIa({ ia }: { ia: ConsumoIaAgregado }) {
  const tokens = ia.tokensEntrada + ia.tokensSalida;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-borde/70 bg-paper/60 px-3 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Interpretaciones
        </p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink">
          {formatearEntero(ia.interpretaciones)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {formatearEntero(ia.interpretacionesExitosas)} ok ·{' '}
          {formatearEntero(ia.interpretacionesFallidas)} fallidas
        </p>
      </div>
      <div className="rounded-xl border border-borde/70 bg-paper/60 px-3 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Tokens
        </p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink">
          {formatearEntero(tokens)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {formatearEntero(ia.tokensEntrada)} in ·{' '}
          {formatearEntero(ia.tokensSalida)} out
        </p>
      </div>
      <div className="rounded-xl border border-borde/70 bg-paper/60 px-3 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Costo estimado
        </p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink">
          {formatearCostoUsd(ia.costoEstimado)}
        </p>
        <p className="mt-0.5 text-xs text-muted">USD · metadato técnico</p>
      </div>
    </div>
  );
}

function VistaMetricasDetalle({
  costoIa,
  costoHint,
  cotizaciones,
  cotizacionesHint,
  tasaAprobacion,
  tasaHint,
  cuartoKpi,
  ia,
  porEstado,
  ganadas,
  perdidas,
}: {
  costoIa: string;
  costoHint: string;
  cotizaciones: number;
  cotizacionesHint: string;
  tasaAprobacion: string;
  tasaHint: string;
  cuartoKpi: { label: string; value: string; hint: string };
  ia: ConsumoIaAgregado;
  porEstado: CantidadPorEstado;
  ganadas: number;
  perdidas: number;
}) {
  return (
    <>
      <section className="animate-rise grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          accent
          label="Costo IA estimado"
          value={formatearCostoUsd(costoIa)}
          hint={costoHint}
        />
        <KpiCard
          label="Cotizaciones"
          value={formatearEntero(cotizaciones)}
          hint={cotizacionesHint}
        />
        <KpiCard
          label="Tasa de aprobación"
          value={tasaPct(tasaAprobacion)}
          hint={tasaHint}
        />
        <KpiCard
          label={cuartoKpi.label}
          value={cuartoKpi.value}
          hint={cuartoKpi.hint}
        />
      </section>

      <section className="animate-rise-delay rounded-2xl border border-borde/80 bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-teal" aria-hidden />
          <h2 className="text-sm font-bold text-ink">Consumo de IA</h2>
        </div>
        <p className="mt-1 text-xs text-muted">
          Tokens y costo técnico de interpretaciones. No es venta ni
          facturación al cliente final.
        </p>
        <div className="mt-4">
          <BloqueIa ia={ia} />
        </div>
      </section>

      <section className="animate-rise-late rounded-2xl border border-borde/80 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brass" aria-hidden />
              <h2 className="text-sm font-bold text-ink">
                Cotizaciones por estado
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted">
              Pipeline del periodo: cada color es un estado distinto.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Timer className="size-3.5" aria-hidden />
            Ganadas {formatearEntero(ganadas)} · Perdidas{' '}
            {formatearEntero(perdidas)}
          </p>
        </div>
        <BarraEstados porEstado={porEstado} className="mt-5 h-5" />
        <LeyendaEstados porEstado={porEstado} />
      </section>
    </>
  );
}

export default function PlataformaMetricasPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vista, setVista] = useState<Vista>('general');
  const [organizacionId, setOrganizacionId] = useState('');
  const [data, setData] = useState<MetricasPlataforma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ detalle: 'true' });
      if (desde) {
        params.set('desde', new Date(`${desde}T00:00:00.000Z`).toISOString());
      }
      if (hasta) {
        params.set('hasta', new Date(`${hasta}T23:59:59.999Z`).toISOString());
      }
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

  const orgsOrdenadas = useMemo(
    () => data?.porOrganizacion ?? [],
    [data?.porOrganizacion],
  );

  useEffect(() => {
    if (orgsOrdenadas.length === 0) {
      setOrganizacionId('');
      return;
    }
    setOrganizacionId((prev) => {
      if (prev && orgsOrdenadas.some((o) => o.organizacionId === prev)) {
        return prev;
      }
      return orgsOrdenadas[0]!.organizacionId;
    });
  }, [orgsOrdenadas]);

  const orgSeleccionada = useMemo(
    () =>
      orgsOrdenadas.find((o) => o.organizacionId === organizacionId) ?? null,
    [orgsOrdenadas, organizacionId],
  );

  function aplicar(e: FormEvent) {
    e.preventDefault();
    void cargar();
  }

  return (
    <AppShell nav="plataforma" maxWidth="lg">
      <BackLink href="/panel">Volver al panel</BackLink>
      <PageHeader
        title="Dashboard de plataforma"
        description="Pulso de uso y consumo de IA. Solo agregados: sin clientes, folios ni textos."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <form
          onSubmit={aplicar}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm">
            <span className="mb-1 block text-sm font-semibold text-muted">
              Desde
            </span>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-sm font-semibold text-muted">
              Hasta
            </span>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={loading}>
            Actualizar
          </Button>
        </form>

        <div
          className="inline-flex rounded-xl border border-borde bg-surface p-1"
          role="tablist"
          aria-label="Vista del dashboard"
        >
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'general'}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition',
              vista === 'general'
                ? 'bg-teal text-white'
                : 'text-slate hover:bg-paper',
            )}
            onClick={() => setVista('general')}
          >
            <LayoutDashboard className="size-4" aria-hidden />
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'organizaciones'}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition',
              vista === 'organizaciones'
                ? 'bg-teal text-white'
                : 'text-slate hover:bg-paper',
            )}
            onClick={() => setVista('organizaciones')}
          >
            <Building2 className="size-4" aria-hidden />
            Por organización
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      ) : data ? (
        <div className="space-y-6">
          {vista === 'general' ? (
            <VistaMetricasDetalle
              costoIa={data.ia.costoEstimado}
              costoHint="Suma del periodo · USD"
              cotizaciones={data.cotizacionesTotales}
              cotizacionesHint={`${formatearEntero(data.organizacionesActivas)} orgs con actividad`}
              tasaAprobacion={data.tasaAprobacionGlobal}
              tasaHint={`${formatearEntero(data.aprobadasTotales)} aprobadas`}
              cuartoKpi={{
                label: 'Tiempo mediano',
                value: formatearDuracion(data.tiempoMedianoGlobalMs),
                hint: 'Captura → aprobación',
              }}
              ia={data.ia}
              porEstado={data.porEstado}
              ganadas={data.ganadasTotales}
              perdidas={data.perdidasTotales}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block min-w-0 flex-1 text-sm sm:max-w-md">
                  <span className="mb-1 block text-sm font-semibold text-muted">
                    Organización
                  </span>
                  <Select
                    value={organizacionId}
                    disabled={orgsOrdenadas.length === 0}
                    onChange={(e) => setOrganizacionId(e.target.value)}
                  >
                    {orgsOrdenadas.length === 0 ? (
                      <option value="">Sin actividad en el periodo</option>
                    ) : (
                      orgsOrdenadas.map((org) => (
                        <option
                          key={org.organizacionId}
                          value={org.organizacionId}
                        >
                          {org.nombre}
                        </option>
                      ))
                    )}
                  </Select>
                </label>
                {orgSeleccionada ? (
                  <p className="text-sm text-muted sm:pb-2">
                    {formatearEntero(orgSeleccionada.cotizaciones)} cotizaciones
                    · {formatearEntero(orgSeleccionada.aprobadas)} aprobadas
                  </p>
                ) : null}
              </div>

              {orgSeleccionada ? (
                <VistaMetricasDetalle
                  costoIa={orgSeleccionada.ia.costoEstimado}
                  costoHint={`${orgSeleccionada.nombre} · USD`}
                  cotizaciones={orgSeleccionada.cotizaciones}
                  cotizacionesHint="Creadas en el periodo"
                  tasaAprobacion={
                    orgSeleccionada.cotizaciones > 0
                      ? (
                          orgSeleccionada.aprobadas /
                          orgSeleccionada.cotizaciones
                        ).toFixed(4)
                      : '0'
                  }
                  tasaHint={`${formatearEntero(orgSeleccionada.aprobadas)} aprobadas`}
                  cuartoKpi={{
                    label: 'Interpretaciones IA',
                    value: formatearEntero(
                      orgSeleccionada.ia.interpretaciones,
                    ),
                    hint: `${formatearEntero(orgSeleccionada.ia.tokensEntrada + orgSeleccionada.ia.tokensSalida)} tokens`,
                  }}
                  ia={orgSeleccionada.ia}
                  porEstado={orgSeleccionada.porEstado}
                  ganadas={orgSeleccionada.ganadas}
                  perdidas={orgSeleccionada.perdidas}
                />
              ) : (
                <p className="rounded-2xl border border-borde/80 bg-surface px-4 py-12 text-center text-sm text-muted">
                  Sin actividad de organizaciones en el periodo.
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
