'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search } from 'lucide-react';
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
import {
  etiquetaEstadoCotizacion,
  toneEstadoCotizacion,
  type EstadoCotizacion,
} from '@/lib/cotizaciones';

type CotizacionRow = {
  id: string;
  folio: string;
  estado: EstadoCotizacion | string;
  total: string;
  anulado: boolean;
  clienteId: string | null;
  nombreCliente: string | null;
  createdAt: string;
  usuarioNombre: string | null;
};

type Listado = {
  items: CotizacionRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  vencidasMarcadas: number;
};

const ESTADOS: Array<EstadoCotizacion | ''> = [
  '',
  'BORRADOR',
  'APROBADA',
  'ENVIADA',
  'VENCIDA',
  'GANADA',
  'PERDIDA',
  'ANULADA',
];

function formatearFecha(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function HistorialPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [data, setData] = useState<Listado | null>(null);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<EstadoCotizacion | ''>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [avisoVencidas, setAvisoVencidas] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (search.trim()) params.set('search', search.trim());
      if (estado) params.set('estado', estado);
      if (desde) params.set('desde', new Date(`${desde}T00:00:00.000Z`).toISOString());
      if (hasta) params.set('hasta', new Date(`${hasta}T23:59:59.999Z`).toISOString());

      const result = await apiFetch<Listado>(
        `/cotizaciones?${params.toString()}`,
      );
      setData(result);
      if (result.vencidasMarcadas > 0) {
        setAvisoVencidas(
          result.vencidasMarcadas === 1
            ? 'Se marcó 1 cotización vencida al cargar el listado.'
            : `Se marcaron ${result.vencidasMarcadas} cotizaciones vencidas al cargar el listado.`,
        );
      } else {
        setAvisoVencidas(null);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setError('No tiene permiso para ver el historial.');
        return;
      }
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo cargar.',
      );
    } finally {
      setLoading(false);
    }
  }, [desde, estado, hasta, page, router, search]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.COTIZACIONES_VER)) {
          setError('No tiene permiso para ver el historial.');
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
        title="Historial"
        description="Todas las cotizaciones del mostrador: borradores, enviadas, ganadas y anuladas."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {avisoVencidas ? (
        <StatusBanner tone="info">{avisoVencidas}</StatusBanner>
      ) : null}

      <form
        onSubmit={(e) => void buscar(e)}
        className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]"
      >
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Folio o cliente"
            className="pl-10"
          />
        </div>
        <Select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as EstadoCotizacion | '');
            setPage(1);
          }}
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.filter(Boolean).map((e) => (
            <option key={e} value={e}>
              {etiquetaEstadoCotizacion(e)}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={desde}
          onChange={(e) => {
            setDesde(e.target.value);
            setPage(1);
          }}
          aria-label="Desde"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => {
            setHasta(e.target.value);
            setPage(1);
          }}
          aria-label="Hasta"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/35"
        >
          Filtrar
        </button>
      </form>

      {loading && !data ? (
        <p className="py-12 text-center text-sm text-muted">Cargando…</p>
      ) : !data?.items.length ? (
        <StatusBanner tone="info">
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="size-4" />
            No hay cotizaciones con esos filtros.
          </span>
        </StatusBanner>
      ) : (
        <ul className="space-y-2">
          {data.items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cotizaciones/${c.id}`}
                className={`group flex items-center gap-3 rounded-2xl border border-borde/80 bg-surface px-4 py-3.5 transition hover:border-teal/35 ${
                  c.anulado || c.estado === 'ANULADA' ? 'opacity-70' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-ink">
                      {c.folio}
                    </span>
                    <Badge tone={toneEstadoCotizacion(c.estado)}>
                      {etiquetaEstadoCotizacion(c.estado)}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {[
                      c.nombreCliente || 'Sin cliente',
                      formatearFecha(c.createdAt),
                      c.usuarioNombre,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-base font-bold tabular-nums text-ink">
                    {c.total}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-muted">
                    moneda base
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
