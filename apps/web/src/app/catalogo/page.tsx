'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Search, MessageSquareWarning } from 'lucide-react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  TIPO_ITEM_LABEL,
  type ItemResumen,
  type MaestraOpcion,
} from '@/lib/items';
import {
  AppShell,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';

type Listado = {
  items: ItemResumen[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type ResultadoBusqueda = {
  itemId: string;
  sku: string | null;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  unidadCodigo: string;
  tipoItem?: string;
  puntaje: string;
  origenMatch: string;
  aliasCoincidente: string | null;
  stockAproximado: string | null;
};

type PerfilAuth = {
  usuario: { id: string };
  contexto: OrgContext;
};

export default function CatalogoItemsPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [data, setData] = useState<Listado | null>(null);
  const [busqueda, setBusqueda] = useState<ResultadoBusqueda[] | null>(null);
  const [modoBusqueda, setModoBusqueda] = useState(false);
  const [categorias, setCategorias] = useState<MaestraOpcion[]>([]);
  const [marcas, setMarcas] = useState<MaestraOpcion[]>([]);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'ACTIVO' | 'INACTIVO' | 'TODOS'>('ACTIVO');
  const [categoriaId, setCategoriaId] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [tipoItem, setTipoItem] = useState('');
  const [orden, setOrden] = useState<'nombre' | 'sku' | 'updatedAt'>('nombre');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const puedeCrear = auth
    ? hasPermission(auth.contexto, PERMISOS.CATALOGO_ITEMS_CREAR)
    : false;

  const cargarListado = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      setModoBusqueda(false);
      setBusqueda(null);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '20',
          estadoRegistro: estado,
          orden,
          direccion: 'ASC',
        });
        if (categoriaId) params.set('categoriaId', categoriaId);
        if (marcaId) params.set('marcaId', marcaId);
        if (tipoItem) params.set('tipoItem', tipoItem);
        const result = await apiFetch<Listado>(`/items?${params.toString()}`);
        setData(result);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        if (err instanceof ApiClientError && err.status === 403) {
          setError('No tiene permiso para ver el catálogo.');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar.');
      } finally {
        setLoading(false);
      }
    },
    [categoriaId, estado, marcaId, orden, router, tipoItem],
  );

  const cargarBusqueda = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      setModoBusqueda(true);
      setData(null);
      try {
        const params = new URLSearchParams({ q, limit: '25' });
        if (estado === 'ACTIVO' || estado === 'INACTIVO') {
          params.set('estadoRegistro', estado);
        }
        if (categoriaId) params.set('categoriaId', categoriaId);
        if (marcaId) params.set('marcaId', marcaId);
        if (tipoItem) params.set('tipoItem', tipoItem);
        const result = await apiFetch<ResultadoBusqueda[]>(
          `/items/buscar?${params.toString()}`,
        );
        setBusqueda(result);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'No se pudo buscar.');
      } finally {
        setLoading(false);
      }
    },
    [categoriaId, estado, marcaId, router, tipoItem],
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const perfil = await apiFetch<PerfilAuth>('/auth/perfil');
        if (perfil.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        if (!hasPermission(perfil.contexto, PERMISOS.CATALOGO_ITEMS_VER)) {
          setError('No tiene permiso para ver el catálogo.');
          setLoading(false);
          return;
        }
        setAuth(perfil);
        const [cats, mars] = await Promise.all([
          apiFetch<{ items: MaestraOpcion[] }>('/categorias?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: MaestraOpcion[] }>('/marcas?limit=100&estadoRegistro=ACTIVO'),
        ]);
        setCategorias(cats.items);
        setMarcas(mars.items);
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
    if (!auth) return;
    if (search.trim().length >= 2) return;
    void cargarListado(page);
  }, [auth, cargarListado, page, search]);

  function onFiltrar(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    if (search.trim().length >= 2) {
      void cargarBusqueda(search.trim());
    } else {
      setModoBusqueda(false);
      void cargarListado(1);
    }
  }

  const origenLabel: Record<string, string> = {
    SKU: 'SKU',
    ALIAS_EXACTO: 'Alias exacto',
    ALIAS_SIMILITUD: 'Alias',
    TEXTO_SIMILITUD: 'Texto',
  };

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        title="Catálogo"
        description="Items cotizables de la organización."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/catalogo/importar"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink hover:bg-teal/8"
            >
              Importar
            </Link>
            <Link
              href="/catalogo/terminos"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink hover:bg-teal/8"
            >
              <MessageSquareWarning className="size-4" />
              Términos
            </Link>
            {puedeCrear ? (
              <Link
                href="/catalogo/items/nuevo"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brass px-4 text-sm font-bold text-ink shadow-[0_10px_28px_-12px_rgba(240,162,2,0.55)] hover:bg-brass-dark hover:text-white"
              >
                <Plus className="size-4" />
                Nuevo item
              </Link>
            ) : null}
          </div>
        }
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      <Card className="mb-4">
        <CardBody>
          <form onSubmit={onFiltrar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="mb-1 block text-xs font-medium text-muted">
                Buscar (similitud, mín. 2 caracteres)
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ej. tubo de media, tuvo pvc…"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Estado</span>
              <Select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value as typeof estado);
                  setPage(1);
                }}
              >
                <option value="ACTIVO">Activos</option>
                <option value="INACTIVO">Inactivos</option>
                <option value="TODOS">Todos</option>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Tipo</span>
              <Select
                value={tipoItem}
                onChange={(e) => {
                  setTipoItem(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="FUNGIBLE">Fungible</option>
                <option value="SERIALIZADO">Serializado</option>
                <option value="SERVICIO">Servicio</option>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Orden</span>
              <Select
                value={orden}
                onChange={(e) => {
                  setOrden(e.target.value as typeof orden);
                  setPage(1);
                }}
                disabled={modoBusqueda}
              >
                <option value="nombre">Nombre</option>
                <option value="sku">SKU</option>
                <option value="updatedAt">Actualización</option>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Categoría</span>
              <Select
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Marca</span>
              <Select
                value={marcaId}
                onChange={(e) => {
                  setMarcaId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Filtrar
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {loading && !data && !busqueda ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : modoBusqueda && busqueda ? (
        busqueda.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-muted">Sin resultados para esa búsqueda.</p>
            </CardBody>
          </Card>
        ) : (
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-white">
            {busqueda.map((r) => (
              <li key={r.itemId}>
                <Link
                  href={`/catalogo/items/${r.itemId}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-surface/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.nombre}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[r.sku, r.marca, r.categoria, r.unidadCodigo]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {r.aliasCoincidente ? (
                      <p className="mt-0.5 text-xs text-teal-deep">
                        Coincide por alias «{r.aliasCoincidente}»
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="brand">
                      {origenLabel[r.origenMatch] ?? r.origenMatch}
                    </Badge>
                    <span className="text-xs text-muted">{r.puntaje}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : data && data.items.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">No hay items con esos filtros.</p>
            {puedeCrear ? (
              <Link
                href="/catalogo/items/nuevo"
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brass px-4 text-sm font-bold text-ink"
              >
                Crear el primero
              </Link>
            ) : null}
          </CardBody>
        </Card>
      ) : data ? (
        <>
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-white">
            {data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/catalogo/items/${item.id}`}
                  className={`flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-surface/60 ${
                    item.estadoRegistro === 'INACTIVO' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{item.nombre}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[
                        item.sku,
                        item.marca?.nombre,
                        item.categoria?.nombre,
                        item.unidadMedida.codigo,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="brand">
                      {TIPO_ITEM_LABEL[item.tipoItem] ?? item.tipoItem}
                    </Badge>
                    {item.estadoRegistro === 'INACTIVO' ? (
                      <Badge tone="neutral">Inactivo</Badge>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {data.meta.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted">
                Página {data.meta.page} de {data.meta.totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
