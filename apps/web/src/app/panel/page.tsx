'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';

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

  async function cerrarSesion() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* idempotente */
    }
    clearSession();
    router.replace('/acceso');
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-sm text-muted">Cargando panel…</p>
      </main>
    );
  }

  if (error || !perfil) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5">
        <p className="text-sm text-peligro">{error ?? 'Sesión no disponible.'}</p>
        <Link href="/acceso" className="text-sm font-semibold text-ink underline">
          Volver al acceso
        </Link>
      </main>
    );
  }

  const { usuario, contexto } = perfil;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="font-display text-2xl font-semibold text-ink">
            Cotizador
          </Link>
          <p className="mt-1 text-sm text-muted">Panel</p>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="min-h-11 rounded-md border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-slate"
        >
          Cerrar sesión
        </button>
      </header>

      <section className="space-y-6 rounded-lg border border-borde bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(20,33,43,0.35)]">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Hola, {usuario.nombreCompleto}
          </h1>
          <p className="mt-1 text-sm text-muted">{usuario.email}</p>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Ámbito</dt>
            <dd className="font-medium text-ink">{contexto.ambito}</dd>
          </div>
          <div>
            <dt className="text-muted">Organización</dt>
            <dd className="font-medium text-ink">
              {contexto.organizacionId ?? '— (plataforma)'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Sucursal activa</dt>
            <dd className="font-medium text-ink">
              {contexto.sucursalActivaId ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Sucursales asignadas</dt>
            <dd className="font-medium text-ink">{contexto.sucursalIds.length}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Permisos ({contexto.permisos.length})</dt>
            <dd className="mt-1 max-h-40 overflow-auto rounded-md bg-paper p-3 font-mono text-xs text-slate">
              {contexto.permisos.length > 0
                ? contexto.permisos.join(', ')
                : 'Ninguno'}
            </dd>
          </div>
        </dl>

        {contexto.ambito === 'PLATAFORMA' ? (
          <div className="flex flex-wrap gap-3 border-t border-borde pt-4">
            <Link
              href="/plataforma/organizaciones"
              className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-slate"
            >
              Organizaciones
            </Link>
          </div>
        ) : null}

        {contexto.ambito === 'PLATAFORMA' && (
          <div className="border-t border-borde pt-5">
            <Link
              href="/plataforma/organizaciones"
              className="inline-flex min-h-11 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90"
            >
              Administrar organizaciones
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
