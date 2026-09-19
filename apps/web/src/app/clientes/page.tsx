'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Users } from 'lucide-react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
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
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';

type ClienteRow = {
  id: string;
  nombre: string;
  telefonoWhatsapp: string | null;
  email: string | null;
  identificacionFiscal: string | null;
  listaPrecio: { id: string; codigo: string; nombre: string } | null;
  estadoRegistro: string;
  updatedAt: string;
};

type Listado = {
  items: ClienteRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export default function ClientesPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [data, setData] = useState<Listado | null>(null);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'ACTIVO' | 'INACTIVO' | 'TODOS'>('ACTIVO');
  const [orden, setOrden] = useState<'recientes' | 'nombre'>('recientes');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const puedeCrear =
    contexto && hasPermission(contexto, PERMISOS.CLIENTES_CREAR);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        estadoRegistro: estado,
        orden,
      });
      if (search.trim()) params.set('search', search.trim());
      const result = await apiFetch<Listado>(`/clientes?${params.toString()}`);
      setData(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setError('No tiene permiso para ver clientes.');
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [estado, orden, page, router, search]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.CLIENTES_VER)) {
          setError('No tiene permiso para ver clientes.');
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

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    await cargar();
  }

  if (error && !contexto && !loading) {
    return (
      <AppShell nav="organizacion">
        <StatusBanner tone="error">{error}</StatusBanner>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        title="Clientes"
        description="Quienes piden cotizaciones por WhatsApp. Lista de precios y notas internas."
        action={
          puedeCrear ? (
            <Link
              href="/clientes/nuevo"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brass px-4 text-sm font-bold text-ink shadow-[0_10px_28px_-12px_rgba(240,162,2,0.55)] transition hover:bg-brass-dark hover:text-white"
            >
              <Plus className="size-4" />
              Nuevo
            </Link>
          ) : null
        }
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      <form
        onSubmit={(e) => void buscar(e)}
        className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, WhatsApp o identificación"
            className="pl-10"
          />
        </div>
        <Select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as typeof estado);
            setPage(1);
          }}
          aria-label="Estado"
        >
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
          <option value="TODOS">Todos</option>
        </Select>
        <Select
          value={orden}
          onChange={(e) => {
            setOrden(e.target.value as typeof orden);
            setPage(1);
          }}
          aria-label="Orden"
        >
          <option value="recientes">Recientes</option>
          <option value="nombre">Nombre</option>
        </Select>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/35"
        >
          Buscar
        </button>
      </form>

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-muted">Cargando…</p>
      ) : !data?.items.length ? (
        <StatusBanner tone="info">
          <span className="inline-flex items-center gap-2">
            <Users className="size-4" />
            No hay clientes con esos filtros.
          </span>
        </StatusBanner>
      ) : (
        <ul className="space-y-2">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clientes/${c.id}`}
                className={`group flex items-center gap-3 rounded-2xl border border-borde/80 bg-surface px-4 py-3.5 transition hover:border-teal/35 ${
                  c.estadoRegistro === 'INACTIVO' ? 'opacity-60' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-ink">
                      {c.nombre}
                    </span>
                    {c.estadoRegistro === 'INACTIVO' ? (
                      <Badge className="bg-peligro/10 text-peligro">Inactivo</Badge>
                    ) : null}
                    {c.listaPrecio ? (
                      <Badge>{c.listaPrecio.codigo}</Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {[c.telefonoWhatsapp, c.identificacionFiscal, c.email]
                      .filter(Boolean)
                      .join(' · ') || 'Sin contacto adicional'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.meta.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="min-h-11 rounded-xl border border-borde px-4 text-sm font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-muted">
            Página {data.meta.page} de {data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-11 rounded-xl border border-borde px-4 text-sm font-semibold disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
