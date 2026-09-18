'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
        const result = await apiFetch<ListadoData>(`/organizaciones?${params.toString()}`);
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
          err instanceof ApiClientError ? err.message : 'No se pudo cargar el listado.',
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
      const result = await apiFetch<ListadoData>(`/organizaciones?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo cargar el listado.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell nav="plataforma" maxWidth="lg">
      <PageHeader
        eyebrow={<BackLink href="/panel">← Panel</BackLink>}
        title="Organizaciones"
        description="Ámbito plataforma: alta, estado y provisionamiento."
        action={
          <Link
            href="/plataforma/organizaciones/nueva"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brass px-4 text-sm font-bold text-ink shadow-[0_10px_28px_-12px_rgba(240,162,2,0.55)] transition hover:bg-brass-dark hover:text-white"
          >
            <Plus className="size-4" />
            Nueva
          </Link>
        }
      />

      <form onSubmit={buscar} className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o identificación fiscal"
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {loading ? <p className="text-sm text-muted">Cargando organizaciones…</p> : null}
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {!loading && !error && data ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-borde bg-paper/80 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Vertical</th>
                  <th className="px-4 py-3 font-semibold">Moneda</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      No hay organizaciones registradas.
                    </td>
                  </tr>
                ) : (
                  data.items.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b border-borde/70 transition hover:bg-paper/50 last:border-0"
                    >
                      <td className="px-4 py-3.5 font-semibold text-ink">{org.nombre}</td>
                      <td className="px-4 py-3.5 text-slate">{org.vertical.nombre}</td>
                      <td className="px-4 py-3.5 text-slate">{org.monedaBase.codigoIso}</td>
                      <td className="px-4 py-3.5">
                        <Badge tone={org.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                          {org.estadoRegistro}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-muted">
                        {new Date(org.createdAt).toLocaleDateString('es-VE')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <CardBody className="border-t border-borde/70 py-3">
            <p className="text-xs text-muted">
              {data.meta.total} resultado{data.meta.total === 1 ? '' : 's'}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </AppShell>
  );
}
