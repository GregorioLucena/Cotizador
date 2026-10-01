'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  ESTADOS_COTIZACION,
  PERMISOS,
  hasPermission,
  type CantidadPorEstado,
  type CotizacionesResumen,
  type DesempenoReconocimiento,
  type EstadoCotizacionCodigo,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { etiquetaEstadoCotizacion } from '@/lib/cotizaciones';

const COLOR_ESTADO: Record<EstadoCotizacionCodigo, string> = {
  BORRADOR: '#8b9a96',
  APROBADA: '#0b5f56',
  ENVIADA: '#1d6fe8',
  GANADA: '#1f8a4c',
  PERDIDA: '#d64545',
  VENCIDA: '#e09a12',
  ANULADA: '#3f4f4b',
};

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

function tasaNumero(cadena: string): number {
  const n = Number(cadena);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function formatearMonto(valor: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatearEntero(n: number): string {
  return n.toLocaleString('es-VE');
}

function totalEstados(porEstado: CantidadPorEstado): number {
  return ESTADOS_COTIZACION.reduce((acc, e) => acc + (porEstado[e] ?? 0), 0);
}

function lecturaConversion(tasa: number, ganadas: number, perdidas: number): string {
  const total = ganadas + perdidas;
  if (total === 0) {
    return 'Todavía no hay cotizaciones marcadas como ganadas o perdidas en el periodo.';
  }
  if (tasa >= 0.6) {
    return `Buen cierre: ${formatearEntero(ganadas)} ganadas frente a ${formatearEntero(perdidas)} perdidas.`;
  }
  if (tasa >= 0.35) {
    return `Cierre intermedio: conviene revisar por qué se pierden cotizaciones ya enviadas.`;
  }
  return `Hay más pérdidas que ganancias. Revise precios, tiempos de respuesta y términos del catálogo.`;
}

function lecturaReconocimiento(auto: number, correccion: number): string {
  if (auto >= 0.75 && correccion <= 0.2) {
    return 'El reconocimiento está fluido: pocas correcciones manuales.';
  }
  if (auto < 0.45 || correccion >= 0.35) {
    return 'Hay fricción en el reconocimiento. Curar términos fallidos suele bajar el trabajo manual.';
  }
  return 'Desempeño aceptable. Un poco de curación de alias puede subir la tasa automática.';
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
      if (desde) {
        params.set('desde', new Date(`${desde}T00:00:00.000Z`).toISOString());
      }
      if (hasta) {
        params.set('hasta', new Date(`${hasta}T23:59:59.999Z`).toISOString());
      }
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

  const insights = useMemo(() => {
    if (!resumen || !desempeno) return null;
    const porEstado = resumen.cantidadPorEstado;
    const total = totalEstados(porEstado);
    const ganadas = porEstado.GANADA ?? 0;
    const perdidas = porEstado.PERDIDA ?? 0;
    const conversion = tasaNumero(resumen.conversion);
    const auto = tasaNumero(desempeno.tasaAutomaticas);
    const correccion = tasaNumero(desempeno.tasaCorreccion);
    const maxEstado = Math.max(
      ...ESTADOS_COTIZACION.map((e) => porEstado[e] ?? 0),
      1,
    );
    return {
      porEstado,
      total,
      ganadas,
      perdidas,
      conversion,
      auto,
      correccion,
      maxEstado,
      lecturaCierre: lecturaConversion(conversion, ganadas, perdidas),
      lecturaReco: lecturaReconocimiento(auto, correccion),
    };
  }, [resumen, desempeno]);

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        title="Pulso del mostrador"
        description="De un vistazo: cierre de cotizaciones, velocidad y qué tanto acierta el catálogo con lo que piden por WhatsApp."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      <form
        onSubmit={aplicarPeriodo}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-borde/80 bg-surface p-4"
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
        <p className="w-full text-xs text-muted sm:w-auto sm:pb-2">
          Sin fechas: últimos 30 días.
        </p>
      </form>

      {loading && !resumen ? (
        <p className="py-16 text-center text-sm text-muted">Calculando…</p>
      ) : resumen && desempeno && insights ? (
        <div className="space-y-6">
          {/* Firma: cierre comercial */}
          <section className="animate-rise overflow-hidden rounded-2xl border border-teal/20 bg-gradient-to-br from-teal to-teal-deep text-white shadow-[0_24px_50px_-28px_rgba(11,95,86,0.7)]">
            <div className="grid gap-6 p-5 sm:grid-cols-[1.2fr_1fr] sm:p-6">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/65">
                  Conversión del periodo
                </p>
                <p className="mt-2 font-display text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
                  {tasaPct(resumen.conversion)}
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
                  {insights.lecturaCierre}
                </p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold">
                    <TrendingUp className="size-4" aria-hidden />
                    {formatearEntero(insights.ganadas)} ganadas
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold">
                    <TrendingDown className="size-4" aria-hidden />
                    {formatearEntero(insights.perdidas)} perdidas
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-between rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/60">
                    Cotizaciones en el periodo
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                    {formatearEntero(insights.total)}
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/60">
                    Tiempo mediano a aprobación
                  </p>
                  <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
                    <Clock3 className="size-5 text-brass" aria-hidden />
                    {formatearDuracion(resumen.tiempoMedianoCapturaAprobacionMs)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Montos */}
          <section className="animate-rise-delay grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4 transition hover:-translate-y-0.5 hover:border-exito/30">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Monto ganado
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-exito">
                {formatearMonto(resumen.montoGanado)}
              </p>
              <p className="mt-1 text-xs text-muted">Cotizaciones ganadas</p>
            </div>
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4 transition hover:-translate-y-0.5 hover:border-peligro/30">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Monto perdido
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-peligro">
                {formatearMonto(resumen.montoPerdido)}
              </p>
              <p className="mt-1 text-xs text-muted">Cotizaciones perdidas</p>
            </div>
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4 transition hover:-translate-y-0.5 hover:border-teal/30">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Total aprobado
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">
                {formatearMonto(resumen.montoTotalAprobado)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {resumen.vencidasPendientesDeMarca > 0
                  ? `${resumen.vencidasPendientesDeMarca} enviada(s) vencida(s) sin marcar`
                  : 'Incluye aprobadas y posteriores'}
              </p>
            </div>
          </section>

          {/* Pipeline estados */}
          <section className="animate-rise-late rounded-2xl border border-borde/80 bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Target className="size-4 text-teal" aria-hidden />
                  Embudo por estado
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Dónde están hoy las cotizaciones del periodo.
                </p>
              </div>
            </div>

            <div className="mt-4 flex h-4 w-full gap-1">
              {insights.total === 0 ? (
                <div className="h-full w-full rounded-full bg-borde/40" />
              ) : (
                ESTADOS_COTIZACION.filter(
                  (e) => (insights.porEstado[e] ?? 0) > 0,
                ).map((estado) => {
                  const n = insights.porEstado[estado] ?? 0;
                  return (
                    <span
                      key={estado}
                      title={`${etiquetaEstadoCotizacion(estado)}: ${n}`}
                      className="h-full min-w-[6px] rounded-full"
                      style={{
                        flexGrow: n,
                        background: COLOR_ESTADO[estado],
                      }}
                    />
                  );
                })
              )}
            </div>

            <ul className="mt-4 space-y-2">
              {ESTADOS_COTIZACION.map((estado) => {
                const n = insights.porEstado[estado] ?? 0;
                const pct =
                  insights.total > 0
                    ? Math.round((n / insights.total) * 100)
                    : 0;
                const activo = n > 0;
                return (
                  <li
                    key={estado}
                    className={cn(
                      'grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2',
                      activo
                        ? 'bg-paper/90 ring-1 ring-borde/60'
                        : 'opacity-40',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: COLOR_ESTADO[estado] }}
                      />
                      {etiquetaEstadoCotizacion(estado)}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-borde/40">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${(n / insights.maxEstado) * 100}%`,
                          backgroundColor: COLOR_ESTADO[estado],
                        }}
                      />
                    </div>
                    <span className="min-w-[4.25rem] text-right text-sm tabular-nums">
                      <span className="font-bold text-ink">
                        {formatearEntero(n)}
                      </span>
                      <span className="ml-1 text-xs text-muted">{pct}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Reconocimiento */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-borde/80 bg-surface p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Sparkles className="size-4 text-brass" aria-hidden />
                Acierta el catálogo
              </h2>
              <p className="mt-1 text-xs text-muted">{insights.lecturaReco}</p>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">
                      Líneas automáticas
                    </span>
                    <span className="font-display text-lg font-bold tabular-nums text-teal">
                      {tasaPct(desempeno.tasaAutomaticas)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-borde/45">
                    <div
                      className="h-full rounded-full bg-teal transition-[width] duration-700"
                      style={{ width: `${insights.auto * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatearEntero(desempeno.lineasAutomaticas)} de{' '}
                    {formatearEntero(desempeno.lineasTotales)} líneas
                  </p>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">
                      Correcciones manuales
                    </span>
                    <span className="font-display text-lg font-bold tabular-nums text-ambar">
                      {tasaPct(desempeno.tasaCorreccion)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-borde/45">
                    <div
                      className="h-full rounded-full bg-ambar transition-[width] duration-700"
                      style={{ width: `${insights.correccion * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatearEntero(desempeno.eventosCorreccion)} correcciones
                    en el periodo
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-borde/80 bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Wrench className="size-4 text-teal" aria-hidden />
                    Qué no reconoce el catálogo
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Términos que más fallaron. Curarlos mejora la próxima cotización.
                  </p>
                </div>
                {puedeCurar ? (
                  <Link
                    href="/catalogo/terminos"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-teal hover:underline"
                  >
                    Ir a curación
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>

              {!terminos.length ? (
                <p className="mt-8 rounded-xl bg-exito/8 px-4 py-6 text-center text-sm font-medium text-exito">
                  Sin términos fallidos en el periodo. El catálogo está al día.
                </p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {terminos.slice(0, 8).map((t, i) => (
                    <li
                      key={t.textoNormalizado}
                      className="flex items-center gap-3 rounded-xl bg-paper/90 px-3 py-2.5 ring-1 ring-borde/60"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal/10 font-display text-sm font-bold text-teal">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">
                          {t.ejemploOriginal}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {t.textoNormalizado}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-brass/15 px-2 py-1 text-xs font-bold tabular-nums text-ink">
                        ×{t.vecesVisto}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
