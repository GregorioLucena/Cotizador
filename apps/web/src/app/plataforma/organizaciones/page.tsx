'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';

type OrganizacionItem = {
  id: string;
  nombre: string;
  identificacionFiscal: string | null;
  vertical: { codigo: string; nombre: string };
  monedaBase: { codigoIso: string; simbolo: string };
  estadoRegistro: string;
  createdAt: string;
};

type ListadoData = {
  items: OrganizacionItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type RefreshData = {
  accessToken: string;
  debeCambiarPassword: boolean;
};

export default function OrganizacionesListPage() {
  const router = useRouter();
  const [data, setData] = useState<ListadoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function asegurarSesion() {
      if (getAccessToken()) return true;
      try {
        const refreshed = await apiFetch<RefreshData>('/auth/refresh', {
          method: 'POST',
          token: null,
        });
        setAccessToken(refreshed.accessToken);
        if (refreshed.debeCambiarPassword) {
          router.replace('/acceso/cambiar-password');
          return false;
        }
        return true;
      } catch {
        clearSession();
        router.replace('/acceso');
        return false;
      }
    }

    async function cargar(q?: string) {
      setLoading(true);
      setError(null);
      const ok = await asegurarSesion();
      if (!ok || cancelled) return;

      try {
        const params = new URLSearchParams({
          estadoRegistro: 'TODOS',
          limit: '50',
        });
        if (q?.trim()) params.set('search', q.trim());
        const result = await apiFetch<ListadoData>(
          `/organizaciones?${params.toString()}`,
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        if (err instanceof ApiClientError && err.status === 403) {
          setError('No tiene permiso para ver organizaciones de plataforma.');
          return;
        }
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'No se pudo cargar el listado.',
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

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        estadoRegistro: 'TODOS',
        limit: '50',
      });
      if (search.trim()) params.set('search', search.trim());
      const result = await apiFetch<ListadoData>(
        `/organizaciones?${params.toString()}`,
      );
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo cargar el listado.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/panel" className="text-sm text-muted hover:text-ink">
            ← Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
            Organizaciones
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ámbito plataforma: alta, estado y provisionamiento
          </p>
        </div>
        <Link
          href="/plataforma/organizaciones/nueva"
          className="inline-flex min-h-11 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white hover:bg-teal/90"
        >
          Nueva organización
        </Link>
      </header>

      <form onSubmit={buscar} className="mb-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o identificación fiscal"
          className="min-h-11 min-w-[16rem] flex-1 rounded-md border border-borde bg-surface px-3 text-sm text-ink"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-slate"
        >
          Buscar
        </button>
      </form>

      {loading && (
        <p className="text-sm text-muted">Cargando organizaciones…</p>
      )}
      {error && <p className="text-sm text-peligro">{error}</p>}

      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-lg border border-borde bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-borde bg-paper text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Moneda</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Alta</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No hay organizaciones registradas.
                  </td>
                </tr>
              ) : (
                data.items.map((org) => (
                  <tr key={org.id} className="border-b border-borde last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{org.nombre}</td>
                    <td className="px-4 py-3 text-slate">{org.vertical.nombre}</td>
                    <td className="px-4 py-3 text-slate">
                      {org.monedaBase.codigoIso}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          org.estadoRegistro === 'ACTIVO'
                            ? 'text-exito'
                            : 'text-muted'
                        }
                      >
                        {org.estadoRegistro}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(org.createdAt).toLocaleDateString('es-VE')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="border-t border-borde px-4 py-2 text-xs text-muted">
            {data.meta.total} resultado{data.meta.total === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </main>
  );
}
