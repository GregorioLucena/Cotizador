'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import type { DefinicionAtributoOpcion, MaestraOpcion } from '@/lib/items';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, FormRequiredLegend, RequiredAsterisk } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';

type PerfilAuth = {
  usuario: { id: string };
  contexto: OrgContext;
};

type AtributosState = Record<
  string,
  string | boolean | { desde: string; hasta: string }
>;

export default function NuevoItemPage() {
  return (
    <Suspense
      fallback={
        <AppShell nav="organizacion">
          <p className="p-4 text-sm text-muted">Cargando…</p>
        </AppShell>
      }
    >
      <NuevoItemForm />
    </Suspense>
  );
}

function NuevoItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [unidades, setUnidades] = useState<MaestraOpcion[]>([]);
  const [categorias, setCategorias] = useState<MaestraOpcion[]>([]);
  const [marcas, setMarcas] = useState<MaestraOpcion[]>([]);
  const [definiciones, setDefiniciones] = useState<DefinicionAtributoOpcion[]>([]);
  const [nombre, setNombre] = useState(searchParams.get('nombre') ?? '');
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
  const [aliasTexto, setAliasTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        if (!hasPermission(perfil.contexto, PERMISOS.CATALOGO_ITEMS_CREAR)) {
          setError('No tiene permiso para crear items.');
          return;
        }
        setAuth(perfil);
        const [u, c, m, d] = await Promise.all([
          apiFetch<{ items: MaestraOpcion[] }>('/unidades-medida?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: MaestraOpcion[] }>('/categorias?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: MaestraOpcion[] }>('/marcas?limit=100&estadoRegistro=ACTIVO'),
          apiFetch<{ items: DefinicionAtributoOpcion[] }>(
            '/definiciones-atributo?limit=100&estadoRegistro=ACTIVO',
          ),
        ]);
        setUnidades(u.items);
        setCategorias(c.items);
        setMarcas(m.items);
        setDefiniciones(d.items.sort((a, b) => a.orden - b.orden));
        if (u.items[0]) setUnidadMedidaId(u.items[0].id);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error al cargar.');
      }
    })();
  }, [router]);

  function setAtributo(codigo: string, valor: AtributosState[string]) {
    setAtributos((prev) => ({ ...prev, [codigo]: valor }));
  }

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
        const desde = Number((v as { desde: string }).desde);
        const hasta = Number((v as { hasta: string }).hasta);
        if (!Number.isFinite(desde) && !Number.isFinite(hasta)) continue;
        out[def.codigo] = { desde, hasta };
        continue;
      }
      if (def.tipoDato === 'ENTERO' || def.tipoDato === 'NUMERO') {
        out[def.codigo] = String(v).trim();
        continue;
      }
      out[def.codigo] = String(v).trim();
    }
    return out;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    setError(null);
    try {
      const alias = aliasTexto
        .split('\n')
        .map((a) => a.trim())
        .filter((a) => a.length >= 2);
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        unidadMedidaId,
        tipoItem,
        controlaStock: tipoItem === 'SERVICIO' ? false : controlaStock,
        atributos: construirAtributosPayload(),
      };
      if (sku.trim()) body.sku = sku.trim();
      if (descripcion.trim()) body.descripcion = descripcion.trim();
      if (categoriaId) body.categoriaId = categoriaId;
      if (marcaId) body.marcaId = marcaId;
      if (controlaStock && tipoItem !== 'SERVICIO' && stockAproximado.trim()) {
        body.stockAproximado = stockAproximado.trim();
      }
      if (alias.length) body.alias = alias;

      const created = await apiFetch<{ id: string }>('/items', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.replace(`/catalogo/items/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <BackLink href="/catalogo">Volver al catálogo</BackLink>
      <PageHeader
        title="Nuevo item"
        description="Alta mínima: nombre y unidad de medida."
      />
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {!auth && !error ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : auth ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormRequiredLegend />
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Identificación</h2>
              <Field label="Nombre" required>
                <Input
                  required
                  minLength={3}
                  maxLength={200}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </Field>
              <Field label="SKU">
                <Input
                  maxLength={60}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Opcional, único"
                />
              </Field>
              <Field label="Descripción">
                <Textarea
                  maxLength={2000}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Clasificación</h2>
              <Field label="Unidad" required>
                <Select
                  required
                  value={unidadMedidaId}
                  onChange={(e) => setUnidadMedidaId(e.target.value)}
                >
                  <option value="" disabled>
                    Seleccione
                  </option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo ? `${u.codigo} — ${u.nombre}` : u.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Tipo</span>
                <Select
                  value={tipoItem}
                  onChange={(e) => {
                    const t = e.target.value as typeof tipoItem;
                    setTipoItem(t);
                    if (t === 'SERVICIO') setControlaStock(false);
                  }}
                >
                  <option value="FUNGIBLE">Fungible</option>
                  <option value="SERIALIZADO">Serializado</option>
                  <option value="SERVICIO">Servicio</option>
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Categoría</span>
                <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
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
                <Select value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
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
                        placeholder="0"
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
            </CardBody>
          </Card>

          {definiciones.length > 0 ? (
            <Card>
              <CardBody className="space-y-3">
                <h2 className="text-sm font-bold text-ink">Atributos</h2>
                {definiciones.map((def) => (
                  <AtributoField
                    key={def.id}
                    def={def}
                    value={atributos[def.codigo]}
                    onChange={(v) => setAtributo(def.codigo, v)}
                  />
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Alias iniciales</h2>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Uno por línea (opcional)
                </span>
                <Textarea
                  value={aliasTexto}
                  onChange={(e) => setAliasTexto(e.target.value)}
                  placeholder={'tubo de media\ntubo pvc 1/2'}
                />
              </label>
            </CardBody>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !unidadMedidaId}>
              {saving ? 'Guardando…' : 'Crear item'}
            </Button>
            <Link
              href="/catalogo"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-ink hover:bg-teal/8"
            >
              Cancelar
            </Link>
          </div>
        </form>
      ) : null}
    </AppShell>
  );
}

function AtributoField({
  def,
  value,
  onChange,
}: {
  def: DefinicionAtributoOpcion;
  value: string | boolean | { desde: string; hasta: string } | undefined;
  onChange: (v: string | boolean | { desde: string; hasta: string }) => void;
}) {
  const labelText = `${def.etiqueta}${def.unidadSugerida ? ` (${def.unidadSugerida})` : ''}`;

  if (def.tipoDato === 'BOOLEANO') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {def.etiqueta}
        {def.requerido ? <RequiredAsterisk /> : null}
      </label>
    );
  }

  if (def.tipoDato === 'LISTA') {
    return (
      <Field label={labelText} required={def.requerido}>
        <Select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={def.requerido}
        >
          <option value="">Seleccione</option>
          {(def.opciones ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (def.tipoDato === 'RANGO_ANIO') {
    const rango =
      typeof value === 'object' && value !== null && 'desde' in value
        ? value
        : { desde: '', hasta: '' };
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">
          {def.etiqueta}
          {def.requerido ? <RequiredAsterisk /> : null}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Desde"
            value={rango.desde}
            onChange={(e) => onChange({ ...rango, desde: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Hasta"
            value={rango.hasta}
            onChange={(e) => onChange({ ...rango, hasta: e.target.value })}
          />
        </div>
      </fieldset>
    );
  }

  return (
    <Field label={labelText} required={def.requerido}>
      <Input
        type="text"
        inputMode={def.tipoDato === 'ENTERO' || def.tipoDato === 'NUMERO' ? 'decimal' : undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={def.requerido}
      />
    </Field>
  );
}
