'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Building2,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  MessageSquareText,
  Package,
  Settings2,
  Sparkles,
  Tags,
  Users,
} from 'lucide-react';
import type { CotizacionesResumen, OrgContext } from '@cotizador/shared';
import { PERMISOS, hasPermission } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import { AppShell, StatusBanner } from '@/components/shell/app-shell';
import { cn } from '@/lib/cn';

type PerfilData = {
  usuario: {
    id: string;
    nombreCompleto: string;
    email: string;
    telefono: string | null;
    debeCambiarPassword: boolean;
    ultimoAccesoAt: string | null;
    estadoRegistro: string;
  };
  contexto: OrgContext;
  organizacion: { id: string; nombre: string } | null;
  sucursalActiva: { id: string; nombre: string } | null;
};

type RefreshData = {
  accessToken: string;
  debeCambiarPassword: boolean;
  usuario: { id: string; nombreCompleto: string; email: string };
  contexto: OrgContext;
};

type Acceso = {
  href: string;
  titulo: string;
  desc: string;
  icon: typeof Package;
  accent?: 'teal' | 'brass' | 'plain';
};

function totalCotizaciones(resumen: CotizacionesResumen): number {
  return Object.values(resumen.cantidadPorEstado).reduce((a, n) => a + n, 0);
}

function formatearDuracion(ms: number | null): string {
  if (ms == null) return '—';
  const minutos = Math.round(ms / 60_000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function tasaPct(cadena: string): string {
  const n = Number(cadena);
  if (!Number.isFinite(n)) return '0 %';
  return `${(n * 100).toFixed(0)} %`;
}

function AccesoCard({ acceso }: { acceso: Acceso }) {
  const Icon = acceso.icon;
  const teal = acceso.accent === 'teal';
  const brass = acceso.accent === 'brass';
  return (
    <Link
      href={acceso.href}
      className={cn(
        'group flex min-h-[5.5rem] items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition',
        teal
          ? 'border-teal/25 bg-teal text-white shadow-[0_18px_44px_-18px_rgba(11,95,86,0.55)] hover:bg-teal-deep'
          : 'border-borde/80 bg-surface shadow-[0_14px_40px_-24px_rgba(18,32,30,0.35)] hover:-translate-y-0.5 hover:border-teal/35',
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            teal
              ? 'bg-white/15'
              : brass
                ? 'bg-brass/15 text-brass-dark'
                : 'bg-teal/10 text-teal',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              'block font-display text-lg font-bold',
              teal ? 'text-white' : 'text-ink',
            )}
          >
            {acceso.titulo}
          </span>
          <span
            className={cn(
              'block text-sm',
              teal ? 'text-white/75' : 'text-muted',
            )}
          >
            {acceso.desc}
          </span>
        </span>
      </span>
      <ChevronRight
        className={cn(
          'size-5 shrink-0 transition group-hover:translate-x-0.5',
          teal ? 'text-white/70' : 'text-muted group-hover:text-teal',
        )}
        aria-hidden
      />
    </Link>
  );
}

export default function PanelPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [resumen, setResumen] = useState<CotizacionesResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      if (!getAccessToken()) {
        try {
          const refreshed = await apiFetch<RefreshData>('/auth/refresh', {
            method: 'POST',
            token: null,
          });
          setAccessToken(refreshed.accessToken);
          if (refreshed.debeCambiarPassword) {
            router.replace('/acceso/cambiar-password');
            return;
          }
        } catch {
          router.replace('/acceso');
          return;
        }
      }

      try {
        const data = await apiFetch<PerfilData>('/auth/perfil');
        if (cancelled) return;
        if (data.usuario.debeCambiarPassword) {
          router.replace('/acceso/cambiar-password');
          return;
        }
        setPerfil(data);

        if (
          data.contexto.ambito === 'ORGANIZACION' &&
          hasPermission(data.contexto, PERMISOS.REPORTES_VER)
        ) {
          try {
            const r = await apiFetch<CotizacionesResumen>(
              '/reportes/cotizaciones-resumen',
            );
            if (!cancelled) setResumen(r);
          } catch {
            /* el panel sigue sin el pulso */
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (
          err instanceof ApiClientError &&
          err.code === 'AUTH_CAMBIO_PASSWORD_REQUERIDO'
        ) {
          router.replace('/acceso/cambiar-password');
          return;
        }
        if (err instanceof ApiClientError && err.status === 401) {
          try {
            const refreshed = await apiFetch<RefreshData>('/auth/refresh', {
              method: 'POST',
              token: null,
            });
            setAccessToken(refreshed.accessToken);
            if (refreshed.debeCambiarPassword) {
              router.replace('/acceso/cambiar-password');
              return;
            }
            const data = await apiFetch<PerfilData>('/auth/perfil');
            if (!cancelled) setPerfil(data);
            return;
          } catch {
            clearSession();
            router.replace('/acceso');
            return;
          }
        }
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'No se pudo cargar el perfil.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void cargar();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <AppShell maxWidth="lg">
        <p className="py-20 text-center text-sm text-muted">Cargando panel…</p>
      </AppShell>
    );
  }

  if (error || !perfil) {
    return (
      <AppShell maxWidth="lg">
        <div className="flex flex-col items-center gap-4 py-16">
          <StatusBanner tone="error">
            {error ?? 'Sesión no disponible.'}
          </StatusBanner>
          <Link
            href="/acceso"
            className="text-sm font-semibold text-teal underline"
          >
            Volver al acceso
          </Link>
        </div>
      </AppShell>
    );
  }

  const { usuario, contexto, organizacion, sucursalActiva } = perfil;
  const nav = contexto.ambito === 'PLATAFORMA' ? 'plataforma' : 'organizacion';
  const nombreCorto = usuario.nombreCompleto.split(' ')[0] ?? usuario.nombreCompleto;

  const accesosOrg: Acceso[] = [];
  if (contexto.ambito === 'ORGANIZACION') {
    if (hasPermission(contexto, PERMISOS.COTIZACIONES_CREAR)) {
      accesosOrg.push({
        href: '/cotizar',
        titulo: 'Cotizar',
        desc: 'Pegue el WhatsApp y genere el borrador',
        icon: MessageSquareText,
        accent: 'teal',
      });
    }
    if (hasPermission(contexto, PERMISOS.COTIZACIONES_VER)) {
      accesosOrg.push({
        href: '/historial',
        titulo: 'Historial',
        desc: 'Revise cotizaciones y su bitácora',
        icon: ClipboardList,
      });
    }
    if (hasPermission(contexto, PERMISOS.REPORTES_VER)) {
      accesosOrg.push({
        href: '/reportes',
        titulo: 'Métricas',
        desc: 'Pulso de cierre, tiempos y catálogo',
        icon: ChartColumn,
      });
    }
    if (hasPermission(contexto, PERMISOS.CATALOGO_ITEMS_VER)) {
      accesosOrg.push({
        href: '/catalogo',
        titulo: 'Catálogo',
        desc: 'Ítems, importación y términos',
        icon: Package,
      });
    }
    if (hasPermission(contexto, PERMISOS.PRECIOS_LISTAS_VER)) {
      accesosOrg.push({
        href: '/precios',
        titulo: 'Precios',
        desc: 'Listas, reglas y tasas',
        icon: Tags,
        accent: 'brass',
      });
    }
    if (hasPermission(contexto, PERMISOS.CLIENTES_VER)) {
      accesosOrg.push({
        href: '/clientes',
        titulo: 'Clientes',
        desc: 'Fichas y WhatsApp',
        icon: Users,
      });
    }
    if (
      hasPermission(contexto, PERMISOS.CONFIGURACION_ORGANIZACION_VER) ||
      hasPermission(contexto, PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR)
    ) {
      accesosOrg.push({
        href: '/configuracion',
        titulo: 'Configuración',
        desc: 'Identidad, sucursales y usuarios',
        icon: Settings2,
        accent: 'brass',
      });
    }
  }

  const accesosPlataforma: Acceso[] = [];
  if (contexto.ambito === 'PLATAFORMA') {
    accesosPlataforma.push({
      href: '/plataforma/organizaciones',
      titulo: 'Organizaciones',
      desc: 'Alta y administración de negocios',
      icon: Building2,
      accent: 'teal',
    });
    if (hasPermission(contexto, PERMISOS.PLATAFORMA_METRICAS_VER)) {
      accesosPlataforma.push({
        href: '/plataforma/metricas',
        titulo: 'Dashboard de plataforma',
        desc: 'Uso, estados y consumo de IA',
        icon: ChartColumn,
      });
    }
  }

  const ganadas = resumen?.cantidadPorEstado.GANADA ?? 0;
  const perdidas = resumen?.cantidadPorEstado.PERDIDA ?? 0;
  const borradores = resumen?.cantidadPorEstado.BORRADOR ?? 0;

  return (
    <AppShell nav={nav} maxWidth="lg">
      <section className="animate-rise mb-6 overflow-hidden rounded-2xl border border-teal/20 bg-gradient-to-br from-teal to-teal-deep px-5 py-6 text-white shadow-[0_24px_50px_-28px_rgba(11,95,86,0.65)] sm:px-6">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/65">
          Inicio
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">
          Hola, {nombreCorto}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          {contexto.ambito === 'PLATAFORMA'
            ? 'Administre organizaciones y vea el pulso de la plataforma.'
            : `Trabaje en ${organizacion?.nombre ?? 'su organización'}${
                sucursalActiva?.nombre
                  ? ` · sucursal ${sucursalActiva.nombre}`
                  : ''
              }.`}
        </p>
        {contexto.ambito === 'ORGANIZACION' &&
        hasPermission(contexto, PERMISOS.COTIZACIONES_CREAR) ? (
          <Link
            href="/cotizar"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brass px-4 text-sm font-bold text-ink shadow-[0_10px_28px_-12px_rgba(240,162,2,0.55)] transition hover:bg-brass-dark hover:text-white"
          >
            <MessageSquareText className="size-4" aria-hidden />
            Nueva cotización
          </Link>
        ) : null}
      </section>

      {contexto.ambito === 'ORGANIZACION' && resumen ? (
        <section className="animate-rise-delay mb-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <Sparkles className="size-4 text-brass" aria-hidden />
                Últimos 30 días
              </h2>
              <p className="text-xs text-muted">
                Resumen rápido. El detalle está en Métricas.
              </p>
            </div>
            {hasPermission(contexto, PERMISOS.REPORTES_VER) ? (
              <Link
                href="/reportes"
                className="text-sm font-semibold text-teal hover:underline"
              >
                Ver métricas
              </Link>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Cotizaciones
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">
                {totalCotizaciones(resumen)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {borradores > 0
                  ? `${borradores} en borrador`
                  : 'En el periodo'}
              </p>
            </div>
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Conversión
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-teal">
                {tasaPct(resumen.conversion)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {ganadas} ganadas · {perdidas} perdidas
              </p>
            </div>
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Tiempo a aprobación
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">
                {formatearDuracion(resumen.tiempoMedianoCapturaAprobacionMs)}
              </p>
              <p className="mt-0.5 text-xs text-muted">Mediana captura → aprobación</p>
            </div>
            <div className="rounded-2xl border border-borde/80 bg-surface px-4 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Monto ganado
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-exito">
                {Number(resumen.montoGanado).toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted">Cotizaciones ganadas</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="animate-rise-late">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">
          Accesos rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {contexto.ambito === 'PLATAFORMA'
            ? accesosPlataforma.map((a) => (
                <AccesoCard key={a.href} acceso={a} />
              ))
            : accesosOrg.map((a) => <AccesoCard key={a.href} acceso={a} />)}
        </div>
        {contexto.ambito === 'ORGANIZACION' && accesosOrg.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No tiene accesos configurados en este perfil. Consulte a un
            administrador.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
