'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, TextField } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';

type Tab = 'unidades' | 'categorias' | 'marcas' | 'atributos';

type Meta = { page: number; limit: number; total: number; totalPages: number };

type Unidad = {
  id: string;
  codigo: string;
  nombre: string;
  permiteDecimales: boolean;
  estadoRegistro: string;
};

type Categoria = {
  id: string;
  nombre: string;
  categoriaPadreId: string | null;
  orden: number;
  estadoRegistro: string;
  subcategorias?: Categoria[];
};

type Marca = {
  id: string;
  nombre: string;
  estadoRegistro: string;
};

type Definicion = {
  id: string;
  codigo: string;
  etiqueta: string;
  tipoDato: string;
  opciones: string[] | null;
  unidadSugerida: string | null;
  requerido: boolean;
  usarEnBusqueda: boolean;
  orden: number;
  estadoRegistro: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'unidades', label: 'Unidades' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'marcas', label: 'Marcas' },
  { id: 'atributos', label: 'Atributos' },
];

function MaestrasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab =
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'unidades';

  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'ACTIVO' | 'INACTIVO' | 'TODOS'>('ACTIVO');
  const [loading, setLoading] = useState(true);

  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [definiciones, setDefiniciones] = useState<Definicion[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // form fields
  const [fCodigo, setFCodigo] = useState('');
  const [fNombre, setFNombre] = useState('');
  const [fDecimales, setFDecimales] = useState(false);
  const [fPadreId, setFPadreId] = useState('');
  const [fEtiqueta, setFEtiqueta] = useState('');
  const [fTipo, setFTipo] = useState('TEXTO');
  const [fOpciones, setFOpciones] = useState('');
  const [fRequerido, setFRequerido] = useState(false);
  const [fBusqueda, setFBusqueda] = useState(false);
  const [pending, setPending] = useState(false);

  const puedeAdmin =
    contexto && hasPermission(contexto, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

  const setTab = (id: Tab) => {
    router.replace(`/catalogo/maestras?tab=${id}`);
    setShowForm(false);
    setEditId(null);
    setMsg(null);
    setError(null);
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        estadoRegistro: estado,
        limit: '50',
      });
      if (search.trim()) params.set('search', search.trim());

      if (tab === 'unidades') {
        const data = await apiFetch<{ items: Unidad[]; meta: Meta }>(
          `/unidades-medida?${params}`,
        );
        setUnidades(data.items);
        setMeta(data.meta);
      } else if (tab === 'categorias') {
        params.set('soloRaices', 'true');
        const data = await apiFetch<{ items: Categoria[]; meta: Meta }>(
          `/categorias?${params}`,
        );
        // load children for each root
        const withKids = await Promise.all(
          data.items.map(async (raiz) => {
            const kids = await apiFetch<{ items: Categoria[] }>(
              `/categorias?padreId=${raiz.id}&estadoRegistro=TODOS&limit=100`,
            );
            return { ...raiz, subcategorias: kids.items };
          }),
        );
        setCategorias(withKids);
        setMeta(data.meta);
      } else if (tab === 'marcas') {
        const data = await apiFetch<{ items: Marca[]; meta: Meta }>(
          `/marcas?${params}`,
        );
        setMarcas(data.items);
        setMeta(data.meta);
      } else {
        const data = await apiFetch<{ items: Definicion[]; meta: Meta }>(
          `/definiciones-atributo?${params}`,
        );
        setDefiniciones(data.items);
        setMeta(data.meta);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [estado, router, search, tab]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.CATALOGO_MAESTRAS_VER)) {
          setError('No tiene permiso para ver maestras.');
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
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!contexto) return;
    void cargar();
  }, [contexto, cargar]);

  function resetForm() {
    setFCodigo('');
    setFNombre('');
    setFDecimales(false);
    setFPadreId('');
    setFEtiqueta('');
    setFTipo('TEXTO');
    setFOpciones('');
    setFRequerido(false);
    setFBusqueda(false);
    setEditId(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEditUnidad(u: Unidad) {
    setEditId(u.id);
    setFCodigo(u.codigo);
    setFNombre(u.nombre);
    setFDecimales(u.permiteDecimales);
    setShowForm(true);
  }

  function openEditMarca(m: Marca) {
    setEditId(m.id);
    setFNombre(m.nombre);
    setShowForm(true);
  }

  function openEditDef(d: Definicion) {
    setEditId(d.id);
    setFCodigo(d.codigo);
    setFEtiqueta(d.etiqueta);
    setFTipo(d.tipoDato);
    setFOpciones((d.opciones ?? []).join('\n'));
    setFRequerido(d.requerido);
    setFBusqueda(d.usarEnBusqueda);
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!puedeAdmin) return;
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      if (tab === 'unidades') {
        if (editId) {
          await apiFetch(`/unidades-medida/${editId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              nombre: fNombre,
              permiteDecimales: fDecimales,
            }),
          });
        } else {
          await apiFetch('/unidades-medida', {
            method: 'POST',
            body: JSON.stringify({
              codigo: fCodigo,
              nombre: fNombre,
              permiteDecimales: fDecimales,
            }),
          });
        }
      } else if (tab === 'categorias') {
        await apiFetch('/categorias', {
          method: 'POST',
          body: JSON.stringify({
            nombre: fNombre,
            ...(fPadreId ? { categoriaPadreId: fPadreId } : {}),
          }),
        });
      } else if (tab === 'marcas') {
        if (editId) {
          await apiFetch(`/marcas/${editId}`, {
            method: 'PATCH',
            body: JSON.stringify({ nombre: fNombre }),
          });
        } else {
          await apiFetch('/marcas', {
            method: 'POST',
            body: JSON.stringify({ nombre: fNombre }),
          });
        }
      } else {
        const opciones =
          fTipo === 'LISTA'
            ? fOpciones
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined;
        if (editId) {
          await apiFetch(`/definiciones-atributo/${editId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              etiqueta: fEtiqueta,
              tipoDato: fTipo,
              opciones: fTipo === 'LISTA' ? opciones : null,
              requerido: fRequerido,
              usarEnBusqueda: fBusqueda,
            }),
          });
        } else {
          await apiFetch('/definiciones-atributo', {
            method: 'POST',
            body: JSON.stringify({
              codigo: fCodigo,
              etiqueta: fEtiqueta,
              tipoDato: fTipo,
              ...(opciones ? { opciones } : {}),
              requerido: fRequerido,
              usarEnBusqueda: fBusqueda,
            }),
          });
        }
      }
      setMsg('Maestra guardada');
      setShowForm(false);
      resetForm();
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar');
    } finally {
      setPending(false);
    }
  }

  async function toggleEstado(
    path: string,
    id: string,
    actual: string,
  ) {
    if (!puedeAdmin) return;
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`${path}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          estadoRegistro: actual === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
        }),
      });
      setMsg('Maestra guardada');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cambiar el estado');
    }
  }

  async function moverCategoria(id: string, orden: number) {
    if (!puedeAdmin) return;
    try {
      await apiFetch(`/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ orden: Math.max(0, orden) }),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo reordenar');
    }
  }

  if (error && !contexto) {
    return (
      <AppShell nav="organizacion">
        <StatusBanner tone="error">{error}</StatusBanner>
      </AppShell>
    );
  }

  if (!contexto) {
    return (
      <AppShell nav="organizacion">
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <PageHeader
        title="Maestras de catálogo"
        description="Unidades, categorías, marcas y definiciones de atributo de la organización."
        action={
          puedeAdmin ? (
            <Button type="button" onClick={openCreate} className="gap-2">
              <Plus className="size-4" />
              Nuevo
            </Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap gap-1 rounded-2xl border border-borde/80 bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'min-h-11 flex-1 rounded-xl bg-teal px-3 text-sm font-bold text-white'
                : 'min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold text-slate hover:bg-paper'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void cargar();
        }}
        className="mb-5 flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-10"
          />
        </div>
        <Select
          value={estado}
          onChange={(e) => setEstado(e.target.value as typeof estado)}
        >
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
          <option value="TODOS">Todos</option>
        </Select>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {error ? <div className="mb-4"><StatusBanner tone="error">{error}</StatusBanner></div> : null}
      {msg ? <div className="mb-4"><StatusBanner tone="success">{msg}</StatusBanner></div> : null}

      {showForm && puedeAdmin ? (
        <Card accent className="mb-5">
          <CardHeader
            title={editId ? 'Editar' : 'Nuevo'}
            action={
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cerrar
              </Button>
            }
          />
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4">
              {tab === 'unidades' ? (
                <>
                  {!editId ? (
                    <TextField
                      label="Código *"
                      value={fCodigo}
                      onChange={(e) => setFCodigo(e.target.value)}
                      required
                      maxLength={10}
                    />
                  ) : (
                    <p className="text-sm text-muted">Código: {fCodigo}</p>
                  )}
                  <TextField
                    label="Nombre *"
                    value={fNombre}
                    onChange={(e) => setFNombre(e.target.value)}
                    required
                  />
                  <CheckField
                    label="Permite decimales"
                    checked={fDecimales}
                    onChange={(e) => setFDecimales(e.target.checked)}
                  />
                </>
              ) : null}

              {tab === 'categorias' ? (
                <>
                  <TextField
                    label="Nombre *"
                    value={fNombre}
                    onChange={(e) => setFNombre(e.target.value)}
                    required
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-ink">Padre (opcional)</label>
                    <Select value={fPadreId} onChange={(e) => setFPadreId(e.target.value)}>
                      <option value="">Categoría raíz</option>
                      {categorias
                        .filter((c) => c.estadoRegistro === 'ACTIVO')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                    </Select>
                  </div>
                </>
              ) : null}

              {tab === 'marcas' ? (
                <TextField
                  label="Nombre *"
                  value={fNombre}
                  onChange={(e) => setFNombre(e.target.value)}
                  required
                />
              ) : null}

              {tab === 'atributos' ? (
                <>
                  {!editId ? (
                    <TextField
                      label="Código *"
                      value={fCodigo}
                      onChange={(e) => setFCodigo(e.target.value)}
                      required
                      maxLength={40}
                    />
                  ) : (
                    <p className="text-sm text-muted">Código: {fCodigo} (no editable)</p>
                  )}
                  <TextField
                    label="Etiqueta *"
                    value={fEtiqueta}
                    onChange={(e) => setFEtiqueta(e.target.value)}
                    required
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-ink">Tipo de dato *</label>
                    <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                      {['TEXTO', 'NUMERO', 'ENTERO', 'BOOLEANO', 'LISTA', 'RANGO_ANIO'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
                    </Select>
                  </div>
                  {fTipo === 'LISTA' ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-ink">
                        Opciones (una por línea) *
                      </label>
                      <textarea
                        value={fOpciones}
                        onChange={(e) => setFOpciones(e.target.value)}
                        className="min-h-28 w-full rounded-xl border border-borde bg-white px-3.5 py-3 text-sm"
                        required
                      />
                    </div>
                  ) : null}
                  <CheckField
                    label="Requerido en items"
                    checked={fRequerido}
                    onChange={(e) => setFRequerido(e.target.checked)}
                  />
                  <CheckField
                    label="Usar en búsqueda"
                    checked={fBusqueda}
                    onChange={(e) => setFBusqueda(e.target.checked)}
                  />
                </>
              ) : null}

              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <Card>
          {tab === 'unidades' ? (
            <ul className="divide-y divide-borde/70">
              {unidades.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {u.codigo}{' '}
                      <span className="font-normal text-slate">· {u.nombre}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {u.permiteDecimales ? 'Con decimales' : 'Solo enteros'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={u.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                      {u.estadoRegistro}
                    </Badge>
                    {puedeAdmin ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 text-xs"
                          onClick={() => openEditUnidad(u)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 text-xs"
                          onClick={() =>
                            void toggleEstado('/unidades-medida', u.id, u.estadoRegistro)
                          }
                        >
                          {u.estadoRegistro === 'ACTIVO' ? 'Inactivar' : 'Reactivar'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
              {unidades.length === 0 ? (
                <li className="px-4 py-8 text-center text-muted">Sin resultados</li>
              ) : null}
            </ul>
          ) : null}

          {tab === 'categorias' ? (
            <ul className="divide-y divide-borde/70">
              {categorias.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-ink">{c.nombre}</p>
                      <Badge tone={c.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                        {c.estadoRegistro}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {puedeAdmin ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg p-2 hover:bg-paper"
                            aria-label="Subir"
                            onClick={() => void moverCategoria(c.id, c.orden - 1)}
                          >
                            <ChevronUp className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 hover:bg-paper"
                            aria-label="Bajar"
                            onClick={() => void moverCategoria(c.id, c.orden + 1)}
                          >
                            <ChevronDown className="size-4" />
                          </button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-9 text-xs"
                            onClick={() =>
                              void toggleEstado('/categorias', c.id, c.estadoRegistro)
                            }
                          >
                            {c.estadoRegistro === 'ACTIVO' ? 'Inactivar' : 'Reactivar'}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {c.subcategorias && c.subcategorias.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-l-2 border-teal/20 pl-4">
                      {c.subcategorias.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                        >
                          <span className="text-sm text-ink">{s.nombre}</span>
                          <div className="flex items-center gap-1">
                            <Badge
                              tone={s.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}
                            >
                              {s.estadoRegistro}
                            </Badge>
                            {puedeAdmin ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-8 text-xs"
                                onClick={() =>
                                  void toggleEstado('/categorias', s.id, s.estadoRegistro)
                                }
                              >
                                {s.estadoRegistro === 'ACTIVO' ? 'Inactivar' : 'Reactivar'}
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
              {categorias.length === 0 ? (
                <li className="px-4 py-8 text-center text-muted">Sin resultados</li>
              ) : null}
            </ul>
          ) : null}

          {tab === 'marcas' ? (
            <ul className="divide-y divide-borde/70">
              {marcas.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <p className="font-semibold text-ink">{m.nombre}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={m.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                      {m.estadoRegistro}
                    </Badge>
                    {puedeAdmin ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 text-xs"
                          onClick={() => openEditMarca(m)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 text-xs"
                          onClick={() => void toggleEstado('/marcas', m.id, m.estadoRegistro)}
                        >
                          {m.estadoRegistro === 'ACTIVO' ? 'Inactivar' : 'Reactivar'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
              {marcas.length === 0 ? (
                <li className="px-4 py-8 text-center text-muted">Sin resultados</li>
              ) : null}
            </ul>
          ) : null}

          {tab === 'atributos' ? (
            <ul className="divide-y divide-borde/70">
              {definiciones.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {d.etiqueta}{' '}
                      <span className="font-mono text-xs font-normal text-muted">
                        ({d.codigo})
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {d.tipoDato}
                      {d.requerido ? ' · requerido' : ''}
                      {d.usarEnBusqueda ? ' · búsqueda' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={d.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                      {d.estadoRegistro}
                    </Badge>
                    {puedeAdmin ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 text-xs"
                          onClick={() => openEditDef(d)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-9 text-xs"
                          onClick={() =>
                            void toggleEstado(
                              '/definiciones-atributo',
                              d.id,
                              d.estadoRegistro,
                            )
                          }
                        >
                          {d.estadoRegistro === 'ACTIVO' ? 'Inactivar' : 'Reactivar'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
              {definiciones.length === 0 ? (
                <li className="px-4 py-8 text-center text-muted">Sin resultados</li>
              ) : null}
            </ul>
          ) : null}

          {meta ? (
            <CardBody className="border-t border-borde/70 py-3">
              <p className="text-xs text-muted">
                {meta.total} resultado{meta.total === 1 ? '' : 's'}
              </p>
            </CardBody>
          ) : null}
        </Card>
      )}
    </AppShell>
  );
}

export default function MaestrasPage() {
  return (
    <Suspense
      fallback={
        <AppShell nav="organizacion">
          <p className="py-16 text-center text-sm text-muted">Cargando…</p>
        </AppShell>
      }
    >
      <MaestrasContent />
    </Suspense>
  );
}
