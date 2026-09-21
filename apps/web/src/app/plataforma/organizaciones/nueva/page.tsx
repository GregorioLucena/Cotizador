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
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, Field, FormRequiredLegend, SelectField, TextField } from '@/components/ui/field';
import { Select } from '@/components/ui/input';

type Vertical = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  pack: {
    conteos: {
      unidadesMedida: number;
      definicionesAtributo: number;
      categorias: number;
      subcategorias: number;
    };
  } | null;
};

type Moneda = {
  id: string;
  codigoIso: string;
  nombre: string;
  simbolo: string;
};

type RefreshData = {
  accessToken: string;
  debeCambiarPassword: boolean;
};

type CrearResultado = {
  organizacion: { id: string; nombre: string };
  provisionamiento: {
    verticalCodigo: string;
    packVersion: string;
    unidadesMedidaCreadas: number;
    definicionesAtributoCreadas: number;
    categoriasCreadas: number;
  };
};

const CAMPOS_INICIALES = {
  nombre: '',
  razonSocial: '',
  identificacionFiscal: '',
  telefono: '',
  email: '',
  direccion: '',
  verticalId: '',
  monedaBaseId: '',
  monedaPresentacionId: '',
  zonaHoraria: 'America/Caracas',
  locale: 'es-VE',
  usaIa: true,
  umbralAutomatico: '0.8000',
  umbralDescarte: '0.4500',
  notasInternas: '',
  sucursalNombre: 'Principal',
  sucursalCodigo: 'PRIN',
};

export default function NuevaOrganizacionPage() {
  const router = useRouter();
  const [verticales, setVerticales] = useState<Vertical[]>([]);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [form, setForm] = useState(CAMPOS_INICIALES);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<CrearResultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      try {
        if (!getAccessToken()) {
          const refreshed = await apiFetch<RefreshData>('/auth/refresh', {
            method: 'POST',
            token: null,
          });
          setAccessToken(refreshed.accessToken);
          if (refreshed.debeCambiarPassword) {
            router.replace('/acceso/cambiar-password');
            return;
          }
        }

        const [verts, mons] = await Promise.all([
          apiFetch<Vertical[]>('/verticales'),
          apiFetch<Moneda[]>('/monedas'),
        ]);
        if (cancelled) return;
        setVerticales(verts);
        setMonedas(mons);
        setForm((f) => ({
          ...f,
          verticalId: verts[0]?.id ?? '',
          monedaBaseId: mons.find((m) => m.codigoIso === 'USD')?.id ?? mons[0]?.id ?? '',
        }));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'No se pudieron cargar los catálogos.',
        );
      } finally {
        if (!cancelled) setCargando(false);
      }
    }

    void cargar();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const verticalSeleccionado = verticales.find((v) => v.id === form.verticalId);

  function setField<K extends keyof typeof CAMPOS_INICIALES>(
    key: K,
    value: (typeof CAMPOS_INICIALES)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const body: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        verticalId: form.verticalId,
        monedaBaseId: form.monedaBaseId,
        zonaHoraria: form.zonaHoraria,
        locale: form.locale,
        usaIa: form.usaIa,
        umbralAutomatico: form.umbralAutomatico,
        umbralDescarte: form.umbralDescarte,
        sucursalPrincipal: {
          nombre: form.sucursalNombre.trim() || 'Principal',
          codigo: form.sucursalCodigo.trim() || 'PRIN',
        },
      };

      if (form.razonSocial.trim()) body.razonSocial = form.razonSocial.trim();
      if (form.identificacionFiscal.trim()) {
        body.identificacionFiscal = form.identificacionFiscal.trim();
      }
      if (form.telefono.trim()) body.telefono = form.telefono.trim();
      if (form.email.trim()) body.email = form.email.trim();
      if (form.direccion.trim()) body.direccion = form.direccion.trim();
      if (form.monedaPresentacionId) {
        body.monedaPresentacionId = form.monedaPresentacionId;
      }
      if (form.notasInternas.trim()) {
        body.notasInternas = form.notasInternas.trim();
      }

      const data = await apiFetch<CrearResultado>('/organizaciones', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setExito(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo crear la organización.',
      );
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <AppShell nav="plataforma">
        <p className="py-16 text-center text-sm text-muted">Cargando formulario…</p>
      </AppShell>
    );
  }

  if (exito) {
    return (
      <AppShell nav="plataforma" maxWidth="lg">
        <PageHeader title="Organización creada" />
        <StatusBanner tone="success">
          Organización creada y provisionada correctamente
        </StatusBanner>
        <Card className="mt-5" accent>
          <CardBody className="space-y-2 text-sm text-slate">
            <p className="font-display text-xl font-bold text-ink">
              {exito.organizacion.nombre}
            </p>
            <p>
              Vertical {exito.provisionamiento.verticalCodigo} · pack{' '}
              {exito.provisionamiento.packVersion}
            </p>
            <p>Unidades: {exito.provisionamiento.unidadesMedidaCreadas}</p>
            <p>
              Definiciones de atributo:{' '}
              {exito.provisionamiento.definicionesAtributoCreadas}
            </p>
            <p>Categorías: {exito.provisionamiento.categoriasCreadas}</p>
          </CardBody>
        </Card>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/plataforma/organizaciones/${exito.organizacion.id}`}
            className="inline-flex min-h-11 items-center rounded-xl bg-brass px-4 text-sm font-bold text-ink"
          >
            Ver detalle y crear admin
          </Link>
          <Link
            href="/plataforma/organizaciones"
            className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink"
          >
            Volver al listado
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setExito(null);
              setForm({
                ...CAMPOS_INICIALES,
                verticalId: verticales[0]?.id ?? '',
                monedaBaseId:
                  monedas.find((m) => m.codigoIso === 'USD')?.id ?? monedas[0]?.id ?? '',
              });
            }}
          >
            Crear otra
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell nav="plataforma">
      <PageHeader
        eyebrow={<BackLink href="/plataforma/organizaciones">← Organizaciones</BackLink>}
        title="Nueva organización"
        description="Identidad y configuración inicial. El vertical no se podrá cambiar después."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <FormRequiredLegend />
        <Card accent>
          <CardHeader title="Identidad" />
          <CardBody className="space-y-4">
            <TextField
              label="Nombre comercial"
              value={form.nombre}
              onChange={(e) => setField('nombre', e.target.value)}
              required
            />
            <TextField
              label="Razón social"
              value={form.razonSocial}
              onChange={(e) => setField('razonSocial', e.target.value)}
            />
            <TextField
              label="Identificación fiscal"
              value={form.identificacionFiscal}
              onChange={(e) => setField('identificacionFiscal', e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Teléfono"
                value={form.telefono}
                onChange={(e) => setField('telefono', e.target.value)}
              />
              <TextField
                label="Correo"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </div>
            <TextField
              label="Dirección"
              value={form.direccion}
              onChange={(e) => setField('direccion', e.target.value)}
            />
            <TextField
              label="Notas internas (solo plataforma)"
              value={form.notasInternas}
              onChange={(e) => setField('notasInternas', e.target.value)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Configuración inicial" />
          <CardBody className="space-y-4">
            <Field label="Vertical" required>
              <Select
                required
                value={form.verticalId}
                onChange={(e) => setField('verticalId', e.target.value)}
              >
                {verticales.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                    {v.pack
                      ? ` (${v.pack.conteos.categorias} cat., ${v.pack.conteos.unidadesMedida} und., ${v.pack.conteos.definicionesAtributo} atr.)`
                      : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {verticalSeleccionado?.pack ? (
              <p className="text-xs text-muted">
                El pack aportará {verticalSeleccionado.pack.conteos.categorias} categorías
                {verticalSeleccionado.pack.conteos.subcategorias > 0
                  ? ` (+${verticalSeleccionado.pack.conteos.subcategorias} sub)`
                  : ''}
                , {verticalSeleccionado.pack.conteos.unidadesMedida} unidades y{' '}
                {verticalSeleccionado.pack.conteos.definicionesAtributo} definiciones de
                atributo.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Moneda base"
                required
                value={form.monedaBaseId}
                onChange={(e) => setField('monedaBaseId', e.target.value)}
              >
                {monedas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigoIso} — {m.nombre}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Moneda de presentación"
                value={form.monedaPresentacionId}
                onChange={(e) => setField('monedaPresentacionId', e.target.value)}
              >
                <option value="">Ninguna</option>
                {monedas
                  .filter((m) => m.id !== form.monedaBaseId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigoIso} — {m.nombre}
                    </option>
                  ))}
              </SelectField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Zona horaria"
                value={form.zonaHoraria}
                onChange={(e) => setField('zonaHoraria', e.target.value)}
                required
              />
              <TextField
                label="Locale"
                value={form.locale}
                onChange={(e) => setField('locale', e.target.value)}
                required
              />
            </div>

            <CheckField
              label="Usar IA para precotización"
              checked={form.usaIa}
              onChange={(e) => setField('usaIa', e.target.checked)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Umbral automático"
                value={form.umbralAutomatico}
                onChange={(e) => setField('umbralAutomatico', e.target.value)}
              />
              <TextField
                label="Umbral de descarte"
                value={form.umbralDescarte}
                onChange={(e) => setField('umbralDescarte', e.target.value)}
              />
            </div>
            <p className="text-xs text-muted">
              Por encima del umbral automático la línea sale en verde; por debajo del de
              descarte, en rojo; entre ambos, en ámbar.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Sucursal principal — nombre"
                value={form.sucursalNombre}
                onChange={(e) => setField('sucursalNombre', e.target.value)}
              />
              <TextField
                label="Sucursal principal — código"
                value={form.sucursalCodigo}
                onChange={(e) => setField('sucursalCodigo', e.target.value)}
              />
            </div>
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

        <Button type="submit" disabled={enviando} className="w-full sm:w-auto">
          {enviando ? 'Creando…' : 'Crear y provisionar'}
        </Button>
      </form>
    </AppShell>
  );
}
