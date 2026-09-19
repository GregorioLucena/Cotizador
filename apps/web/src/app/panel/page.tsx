'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronRight, Settings2, Building2, MessageSquareText } from 'lucide-react';
import type { OrgContext } from '@cotizador/shared';
import { PERMISOS, hasPermission } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import { AppShell, StatusBanner } from '@/components/shell/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';

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
};

type RefreshData = {
  accessToken: string;
  debeCambiarPassword: boolean;
  usuario: { id: string; nombreCompleto: string; email: string };
  contexto: OrgContext;
};

export default function PanelPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
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
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.code === 'AUTH_CAMBIO_PASSWORD_REQUERIDO') {
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
        setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar el perfil.');
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
      <AppShell>
        <p className="py-20 text-center text-sm text-muted">Cargando panel…</p>
      </AppShell>
    );
  }

  if (error || !perfil) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-16">
          <StatusBanner tone="error">{error ?? 'Sesión no disponible.'}</StatusBanner>
          <Link href="/acceso" className="text-sm font-semibold text-teal underline">
            Volver al acceso
          </Link>
        </div>
      </AppShell>
    );
  }

  const { usuario, contexto } = perfil;
  const nav = contexto.ambito === 'PLATAFORMA' ? 'plataforma' : 'organizacion';

  return (
    <AppShell nav={nav}>
      <section className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">Panel</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Hola, {usuario.nombreCompleto.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">{usuario.email}</p>
      </section>

      <Card accent className="mb-5">
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{contexto.ambito}</Badge>
            <Badge tone={usuario.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
              {usuario.estadoRegistro}
            </Badge>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-paper/80 p-3.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Organización
              </dt>
              <dd className="mt-1 font-semibold text-ink">
                {contexto.organizacionId ?? 'Plataforma'}
              </dd>
            </div>
            <div className="rounded-xl bg-paper/80 p-3.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Sucursal activa
              </dt>
              <dd className="mt-1 font-semibold text-ink">
                {contexto.sucursalActivaId ?? '—'}
              </dd>
            </div>
            <div className="rounded-xl bg-paper/80 p-3.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Sucursales
              </dt>
              <dd className="mt-1 font-semibold text-ink">{contexto.sucursalIds.length}</dd>
            </div>
            <div className="rounded-xl bg-paper/80 p-3.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                Permisos
              </dt>
              <dd className="mt-1 font-semibold text-ink">{contexto.permisos.length}</dd>
            </div>
          </dl>

          <details className="rounded-xl border border-borde/70 bg-paper/40">
            <summary className="cursor-pointer px-3.5 py-3 text-sm font-semibold text-slate">
              Ver permisos
            </summary>
            <p className="max-h-36 overflow-auto border-t border-borde/70 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate">
              {contexto.permisos.length > 0 ? contexto.permisos.join(', ') : 'Ninguno'}
            </p>
          </details>
        </CardBody>
      </Card>

      <div className="grid gap-3">
        {contexto.ambito === 'PLATAFORMA' ? (
          <Link
            href="/plataforma/organizaciones"
            className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-borde/80 bg-surface px-5 shadow-[0_14px_40px_-24px_rgba(18,32,30,0.4)] transition hover:border-teal/40 hover:shadow-[0_18px_44px_-20px_rgba(11,95,86,0.35)]"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-teal/10 text-teal">
                <Building2 className="size-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-bold text-ink">
                  Organizaciones
                </span>
                <span className="text-sm text-muted">Alta y listado de plataforma</span>
              </span>
            </span>
            <ChevronRight className="size-5 text-muted transition group-hover:text-teal" />
          </Link>
        ) : null}

        {contexto.ambito === 'ORGANIZACION' ? (
          <>
            {hasPermission(contexto, PERMISOS.COTIZACIONES_CREAR) ? (
              <Link
                href="/cotizar"
                className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-teal/25 bg-teal px-5 text-white shadow-[0_18px_44px_-18px_rgba(11,95,86,0.55)] transition hover:bg-teal-deep"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
                    <MessageSquareText className="size-5" />
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold">
                      Cotizar
                    </span>
                    <span className="text-sm text-white/75">
                      Pegá el WhatsApp y generá el borrador
                    </span>
                  </span>
                </span>
                <ChevronRight className="size-5 text-white/70 transition group-hover:translate-x-0.5" />
              </Link>
            ) : null}
            <Link
              href="/configuracion"
              className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-borde/80 bg-surface px-5 shadow-[0_14px_40px_-24px_rgba(18,32,30,0.4)] transition hover:border-teal/40 hover:shadow-[0_18px_44px_-20px_rgba(11,95,86,0.35)]"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brass/15 text-brass-dark">
                  <Settings2 className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-lg font-bold text-ink">
                    Configuración
                  </span>
                  <span className="text-sm text-muted">Identidad, sucursales y cotización</span>
                </span>
              </span>
              <ChevronRight className="size-5 text-muted transition group-hover:text-teal" />
            </Link>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
