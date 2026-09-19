'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  TIPO_ITEM_LABEL,
  type DefinicionAtributoOpcion,
  type ItemDetalle,
  type MaestraOpcion,
} from '@/lib/items';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';

type PerfilAuth = {
  usuario: { id: string };
  contexto: OrgContext;
};

type AtributosState = Record<
  string,
  string | boolean | { desde: string; hasta: string }
>;

export default function ItemDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [item, setItem] = useState<ItemDetalle | null>(null);
  const [unidades, setUnidades] = useState<MaestraOpcion[]>([]);
  const [categorias, setCategorias] = useState<MaestraOpcion[]>([]);
  const [marcas, setMarcas] = useState<MaestraOpcion[]>([]);
  const [definiciones, setDefiniciones] = useState<DefinicionAtributoOpcion[]>([]);

  const [nombre, setNombre] = useState('');
  const [sku, setSku] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidadMedidaId, setUnidadMedidaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [tipoItem, setTipoItem] = useState<'FUNGIBLE' | 'SERIALIZADO' | 'SERVICIO'>(
    'FUNGIBLE',
  );
  const [controlaStock, setControlaStock] = useState(false);
  const [stockAproximado, setStockAproximado] = useState('');
  const [atributos, setAtributos] = useState<AtributosState>({});
  const [nuevoAlias, setNuevoAlias] = useState('');
  const [appMarca, setAppMarca] = useState('');
  const [appModelo, setAppModelo] = useState('');
  const [appAnioDesde, setAppAnioDesde] = useState('');
  const [appAnioHasta, setAppAnioHasta] = useState('');
  const [appPosicion, setAppPosicion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);

  const puedeEditar = auth
    ? hasPermission(auth.contexto, PERMISOS.CATALOGO_ITEMS_EDITAR)
    : false;
  const puedeAlias = auth
    ? hasPermission(auth.contexto, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR)
    : false;

  const hidratar = useCallback((detalle: ItemDetalle) => {
    setItem(detalle);
    setNombre(detalle.nombre);
    setSku(detalle.sku ?? '');
    setDescripcion(detalle.descripcion ?? '');
    setUnidadMedidaId(detalle.unidadMedida.id);
    setCategoriaId(detalle.categoria?.id ?? '');
    setMarcaId(detalle.marca?.id ?? '');
    setTipoItem(detalle.tipoItem);
    setControlaStock(detalle.controlaStock);
    setStockAproximado(detalle.stockAproximado ?? '');
    const attrs: AtributosState = {};
    for (const [k, v] of Object.entries(detalle.atributos ?? {})) {
      if (typeof v === 'boolean') attrs[k] = v;
      else if (typeof v === 'object' && v !== null && 'desde' in v && 'hasta' in v) {
        attrs[k] = {
          desde: String((v as { desde: number }).desde),
          hasta: String((v as { hasta: number }).hasta),
        };
      } else attrs[k] = String(v);
    }
    setAtributos(attrs);
  }, []);

  const cargarItem = useCallback(async () => {
    const detalle = await apiFetch<ItemDetalle>(`/items/${id}`);
    hidratar(detalle);
  }, [hidratar, id]);

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
          setError('No tiene permiso para ver items.');
          return;
        }
        setAuth(perfil);
        const [detalle, u, c, m, d] = await Promise.all([
          apiFetch<ItemDetalle>(`/items/${id}`),
          apiFetch<{ items: MaestraOpcion[] }>('/unidades-medida?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: MaestraOpcion[] }>('/categorias?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: MaestraOpcion[] }>('/marcas?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: DefinicionAtributoOpcion[] }>(
            '/definiciones-atributo?limit=100&estadoRegistro=ACTIVO',
          ),
        ]);
        hidratar(detalle);
        setUnidades(u.items);
        setCategorias(c.items);
        setMarcas(m.items);
        setDefiniciones(d.items.sort((a, b) => a.orden - b.orden));
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar.');
      }
    })();
  }, [hidratar, id, router]);

  function construirAtributosPayload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const def of definiciones) {
      const v = atributos[def.codigo];
      if (v === undefined || v === '') continue;
      if (def.tipoDato === 'BOOLEANO') {
        out[def.codigo] = Boolean(v);
        continue;
      }
      if (def.tipoDato === 'RANGO_ANIO' && typeof v === 'object' && v !== null) {
        out[def.codigo] = {
          desde: Number((v as { desde: string }).desde),
          hasta: Number((v as { hasta: string }).hasta),
        };
        continue;
      }
      out[def.codigo] = String(v).trim();
    }
    // Conservar atributos de definiciones inactivas
    for (const [k, v] of Object.entries(item?.atributos ?? {})) {
      if (out[k] !== undefined) continue;
      if (definiciones.some((d) => d.codigo === k)) continue;
      out[k] = v;
    }
    return out;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!puedeEditar) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        sku: sku.trim() ? sku.trim() : null,
        descripcion: descripcion.trim() ? descripcion.trim() : null,
        unidadMedidaId,
        categoriaId: categoriaId || null,
        marcaId: marcaId || null,
        tipoItem,
        controlaStock: tipoItem === 'SERVICIO' ? false : controlaStock,
        atributos: construirAtributosPayload(),
        stockAproximado:
          controlaStock && tipoItem !== 'SERVICIO' && stockAproximado.trim()
            ? stockAproximado.trim()
            : null,
      };
      const updated = await apiFetch<ItemDetalle>(`/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      hidratar(updated);
      setMsg('Cambios guardados.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function inactivar() {
    if (!puedeEditar || !item) return;
    if (
      !window.confirm(
        'El item dejará de ser cotizable. Las cotizaciones anteriores no cambian. ¿Continuar?',
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const updated = await apiFetch<ItemDetalle>(`/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estadoRegistro: 'INACTIVO' }),
      });
      hidratar(updated);
      setMsg('Item inactivado.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo inactivar.');
    } finally {
      setPending(false);
    }
  }

  async function reactivar() {
    if (!puedeEditar) return;
    setPending(true);
    setError(null);
    try {
      const updated = await apiFetch<ItemDetalle>(`/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estadoRegistro: 'ACTIVO' }),
      });
      hidratar(updated);
      setMsg('Item reactivado.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo reactivar.');
    } finally {
      setPending(false);
    }
  }

  async function agregarAlias() {
    if (!puedeAlias || !nuevoAlias.trim()) return;
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const creado = await apiFetch<{
        advertencias?: string[];
        itemsCompartidos?: Array<{ itemId: string; nombre: string }>;
      }>(`/items/${id}/alias`, {
        method: 'POST',
        body: JSON.stringify({ alias: nuevoAlias.trim() }),
      });
      setNuevoAlias('');
      await cargarItem();
      const avisos = [...(creado.advertencias ?? [])];
      if (creado.itemsCompartidos?.length) {
        avisos.push(
          `También en: ${creado.itemsCompartidos.map((i) => i.nombre).join(', ')}`,
        );
      }
      setMsg(
        avisos.length
          ? `Alias agregado. ${avisos.join(' · ')}`
          : 'Alias agregado.',
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo agregar el alias.');
    } finally {
      setPending(false);
    }
  }

  function onAliasKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void agregarAlias();
    }
  }

  async function depurarAlias(aliasId: string) {
    if (!puedeAlias) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/items/${id}/alias/${aliasId}`, { method: 'DELETE' });
      await cargarItem();
      setMsg('Alias depurado.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo depurar.');
    } finally {
      setPending(false);
    }
  }

  async function crearAplicacion() {
    if (!puedeEditar) return;
    const datos: Record<string, string | number> = {};
    if (appMarca.trim()) datos.marcaVehiculo = appMarca.trim();
    if (appModelo.trim()) datos.modelo = appModelo.trim();
    if (appAnioDesde.trim()) datos.anioDesde = Number(appAnioDesde);
    if (appAnioHasta.trim()) datos.anioHasta = Number(appAnioHasta);
    if (appPosicion.trim()) datos.posicion = appPosicion.trim();
    if (Object.keys(datos).length === 0) {
      setError('Indique al menos un dato de aplicación.');
      return;
    }
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/items/${id}/aplicaciones`, {
        method: 'POST',
        body: JSON.stringify({ datos }),
      });
      setAppMarca('');
      setAppModelo('');
      setAppAnioDesde('');
      setAppAnioHasta('');
      setAppPosicion('');
      await cargarItem();
      setMsg('Aplicación agregada.');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo agregar la aplicación.',
      );
    } finally {
      setPending(false);
    }
  }

  async function eliminarAplicacion(aplicacionId: string) {
    if (!puedeEditar) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/items/${id}/aplicaciones/${aplicacionId}`, {
        method: 'DELETE',
      });
      await cargarItem();
      setMsg('Aplicación eliminada.');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo eliminar.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav="organizacion" maxWidth="md">
      <BackLink href="/catalogo">Volver al catálogo</BackLink>
      <PageHeader
        title={item?.nombre ?? 'Item'}
        description={
          item
            ? `${TIPO_ITEM_LABEL[item.tipoItem]}${item.sku ? ` · ${item.sku}` : ''}`
            : 'Ficha del item'
        }
        action={
          item ? (
            <Badge tone={item.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
              {item.estadoRegistro === 'ACTIVO' ? 'Activo' : 'Inactivo'}
            </Badge>
          ) : null
        }
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}
      {item?.advertencias?.length ? (
        <StatusBanner tone="info">
          {item.advertencias.join(' · ')}
        </StatusBanner>
      ) : null}

      {!item && !error ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : item ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Identificación</h2>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Nombre</span>
                <Input
                  required
                  minLength={3}
                  maxLength={200}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={!puedeEditar}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">SKU</span>
                <Input
                  maxLength={60}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={!puedeEditar}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Descripción</span>
                <Textarea
                  maxLength={2000}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  disabled={!puedeEditar}
                />
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Clasificación</h2>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Unidad</span>
                <Select
                  required
                  value={unidadMedidaId}
                  onChange={(e) => setUnidadMedidaId(e.target.value)}
                  disabled={!puedeEditar}
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo ? `${u.codigo} — ${u.nombre}` : u.nombre}
                    </option>
                  ))}
                  {!unidades.some((u) => u.id === unidadMedidaId) ? (
                    <option value={unidadMedidaId}>{item.unidadMedida.codigo}</option>
                  ) : null}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Tipo</span>
                <Select
                  value={tipoItem}
                  onChange={(e) => setTipoItem(e.target.value as typeof tipoItem)}
                  disabled={!puedeEditar}
                >
                  <option value="FUNGIBLE">Fungible</option>
                  <option value="SERIALIZADO">Serializado</option>
                  <option value="SERVICIO">Servicio</option>
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Categoría</span>
                <Select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  disabled={!puedeEditar}
                >
                  <option value="">Sin categoría</option>
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
                  onChange={(e) => setMarcaId(e.target.value)}
                  disabled={!puedeEditar}
                >
                  <option value="">Sin marca</option>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Select>
              </label>
              {tipoItem !== 'SERVICIO' ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={controlaStock}
                      onChange={(e) => setControlaStock(e.target.checked)}
                      disabled={!puedeEditar}
                    />
                    Controla stock aproximado
                  </label>
                  {controlaStock ? (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">
                        Stock aproximado
                      </span>
                      <Input
                        value={stockAproximado}
                        onChange={(e) => setStockAproximado(e.target.value)}
                        disabled={!puedeEditar}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
            </CardBody>
          </Card>

          {definiciones.length > 0 || Object.keys(atributos).length > 0 ? (
            <Card>
              <CardBody className="space-y-3">
                <h2 className="text-sm font-bold text-ink">Atributos</h2>
                {definiciones.map((def) => (
                  <AtributoField
                    key={def.id}
                    def={def}
                    value={atributos[def.codigo]}
                    disabled={!puedeEditar}
                    onChange={(v) =>
                      setAtributos((prev) => ({ ...prev, [def.codigo]: v }))
                    }
                  />
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Alias</h2>
              {item.alias.filter((a) => a.estadoRegistro === 'ACTIVO').length === 0 ? (
                <p className="text-sm text-muted">Sin alias activos.</p>
              ) : (
                <ul className="divide-y divide-borde rounded-xl border border-borde">
                  {item.alias
                    .filter((a) => a.estadoRegistro === 'ACTIVO')
                    .map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.alias}</p>
                          <p className="text-xs text-muted">
                            {a.origen} · usado {a.vecesUsado}×
                          </p>
                        </div>
                        {puedeAlias ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="shrink-0"
                            disabled={pending}
                            onClick={() => void depurarAlias(a.id)}
                          >
                            Depurar
                          </Button>
                        ) : null}
                      </li>
                    ))}
                </ul>
              )}
              {puedeAlias ? (
                <div className="flex gap-2">
                  <Input
                    value={nuevoAlias}
                    onChange={(e) => setNuevoAlias(e.target.value)}
                    onKeyDown={onAliasKey}
                    placeholder="Nuevo alias + Enter"
                    disabled={pending}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || !nuevoAlias.trim()}
                    onClick={() => void agregarAlias()}
                  >
                    Agregar
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Aplicaciones</h2>
              <p className="text-xs text-muted">
                Compatibilidades (marca, modelo, rango de años). Opcional en ferretería.
              </p>
              {item.aplicaciones.length === 0 ? (
                <p className="text-sm text-muted">Sin aplicaciones activas.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {item.aplicaciones.map((ap) => (
                    <li
                      key={ap.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-borde px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{ap.textoNormalizado}</p>
                        <pre className="mt-1 overflow-x-auto text-xs">
                          {JSON.stringify(ap.datos)}
                        </pre>
                      </div>
                      {puedeEditar ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="shrink-0"
                          disabled={pending}
                          onClick={() => void eliminarAplicacion(ap.id)}
                        >
                          Quitar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {puedeEditar ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Marca vehículo"
                    value={appMarca}
                    onChange={(e) => setAppMarca(e.target.value)}
                    disabled={pending}
                  />
                  <Input
                    placeholder="Modelo"
                    value={appModelo}
                    onChange={(e) => setAppModelo(e.target.value)}
                    disabled={pending}
                  />
                  <Input
                    type="number"
                    placeholder="Año desde"
                    value={appAnioDesde}
                    onChange={(e) => setAppAnioDesde(e.target.value)}
                    disabled={pending}
                  />
                  <Input
                    type="number"
                    placeholder="Año hasta"
                    value={appAnioHasta}
                    onChange={(e) => setAppAnioHasta(e.target.value)}
                    disabled={pending}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Posición (opcional)"
                    value={appPosicion}
                    onChange={(e) => setAppPosicion(e.target.value)}
                    disabled={pending}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="sm:col-span-2"
                    disabled={pending}
                    onClick={() => void crearAplicacion()}
                  >
                    Agregar aplicación
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {puedeEditar ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              {item.estadoRegistro === 'ACTIVO' ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => void inactivar()}
                >
                  Inactivar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void reactivar()}
                >
                  Reactivar
                </Button>
              )}
              <Link
                href="/catalogo"
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-ink hover:bg-teal/8"
              >
                Volver
              </Link>
            </div>
          ) : (
            <Link
              href="/catalogo"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-ink hover:bg-teal/8"
            >
              Volver
            </Link>
          )}
        </form>
      ) : null}
    </AppShell>
  );
}

function AtributoField({
  def,
  value,
  disabled,
  onChange,
}: {
  def: DefinicionAtributoOpcion;
  value: string | boolean | { desde: string; hasta: string } | undefined;
  disabled?: boolean;
  onChange: (v: string | boolean | { desde: string; hasta: string }) => void;
}) {
  const label = (
    <span className="mb-1 block text-xs font-medium text-muted">
      {def.etiqueta}
      {def.requerido ? ' *' : ''}
      {def.unidadSugerida ? ` (${def.unidadSugerida})` : ''}
    </span>
  );

  if (def.tipoDato === 'BOOLEANO') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {def.etiqueta}
        {def.requerido ? ' *' : ''}
      </label>
    );
  }

  if (def.tipoDato === 'LISTA') {
    return (
      <label className="block">
        {label}
        <Select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={def.requerido}
        >
          <option value="">Seleccione</option>
          {(def.opciones ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </label>
    );
  }

  if (def.tipoDato === 'RANGO_ANIO') {
    const rango =
      typeof value === 'object' && value !== null && 'desde' in value
        ? value
        : { desde: '', hasta: '' };
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted">
          {def.etiqueta}
          {def.requerido ? ' *' : ''}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Desde"
            value={rango.desde}
            disabled={disabled}
            onChange={(e) => onChange({ ...rango, desde: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Hasta"
            value={rango.hasta}
            disabled={disabled}
            onChange={(e) => onChange({ ...rango, hasta: e.target.value })}
          />
        </div>
      </fieldset>
    );
  }

  return (
    <label className="block">
      {label}
      <Input
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={def.requerido}
      />
    </label>
  );
}
