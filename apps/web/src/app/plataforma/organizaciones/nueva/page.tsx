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
      <main className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-sm text-muted">Cargando formulario…</p>
      </main>
    );
  }

  if (exito) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Organización creada
        </h1>
        <p className="mt-2 text-sm text-exito">
          Organización creada y provisionada correctamente
        </p>
        <ul className="mt-6 space-y-2 rounded-lg border border-borde bg-surface p-5 text-sm text-slate">
          <li>
            <strong className="text-ink">{exito.organizacion.nombre}</strong>
          </li>
          <li>
            Vertical {exito.provisionamiento.verticalCodigo} · pack{' '}
            {exito.provisionamiento.packVersion}
          </li>
          <li>
            Unidades: {exito.provisionamiento.unidadesMedidaCreadas}
          </li>
          <li>
            Definiciones de atributo:{' '}
            {exito.provisionamiento.definicionesAtributoCreadas}
          </li>
          <li>Categorías: {exito.provisionamiento.categoriasCreadas}</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/plataforma/organizaciones"
            className="inline-flex min-h-11 items-center rounded-md bg-teal px-4 text-sm font-semibold text-white"
          >
            Volver al listado
          </Link>
          <Link
            href="/plataforma/organizaciones/nueva"
            className="inline-flex min-h-11 items-center rounded-md border border-borde bg-surface px-4 text-sm font-semibold text-ink"
            onClick={() => {
              setExito(null);
              setForm({
                ...CAMPOS_INICIALES,
                verticalId: verticales[0]?.id ?? '',
                monedaBaseId:
                  monedas.find((m) => m.codigoIso === 'USD')?.id ??
                  monedas[0]?.id ??
                  '',
              });
            }}
          >
            Crear otra
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10">
      <Link
        href="/plataforma/organizaciones"
        className="text-sm text-muted hover:text-ink"
      >
        ← Organizaciones
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        Nueva organización
      </h1>
      <p className="mt-1 text-sm text-muted">
        Identidad y configuración inicial. El vertical no se podrá cambiar después.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <section className="space-y-4 rounded-lg border border-borde bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Identidad</h2>
          <Campo
            label="Nombre comercial *"
            value={form.nombre}
            onChange={(v) => setField('nombre', v)}
            required
          />
          <Campo
            label="Razón social"
            value={form.razonSocial}
            onChange={(v) => setField('razonSocial', v)}
          />
          <Campo
            label="Identificación fiscal"
            value={form.identificacionFiscal}
            onChange={(v) => setField('identificacionFiscal', v)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Teléfono"
              value={form.telefono}
              onChange={(v) => setField('telefono', v)}
            />
            <Campo
              label="Correo"
              type="email"
              value={form.email}
              onChange={(v) => setField('email', v)}
            />
          </div>
          <Campo
            label="Dirección"
            value={form.direccion}
            onChange={(v) => setField('direccion', v)}
          />
          <Campo
            label="Notas internas (solo plataforma)"
            value={form.notasInternas}
            onChange={(v) => setField('notasInternas', v)}
          />
        </section>

        <section className="space-y-4 rounded-lg border border-borde bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">
            Configuración inicial
          </h2>

          <label className="block text-sm">
            <span className="text-muted">Vertical *</span>
            <select
              required
              value={form.verticalId}
              onChange={(e) => setField('verticalId', e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink"
            >
              {verticales.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                  {v.pack
                    ? ` (${v.pack.conteos.categorias} cat., ${v.pack.conteos.unidadesMedida} und., ${v.pack.conteos.definicionesAtributo} atr.)`
                    : ''}
                </option>
              ))}
            </select>
          </label>
          {verticalSeleccionado?.pack && (
            <p className="text-xs text-muted">
              El pack aportará {verticalSeleccionado.pack.conteos.categorias}{' '}
              categorías
              {verticalSeleccionado.pack.conteos.subcategorias > 0
                ? ` (+${verticalSeleccionado.pack.conteos.subcategorias} sub)`
                : ''}
              , {verticalSeleccionado.pack.conteos.unidadesMedida} unidades y{' '}
              {verticalSeleccionado.pack.conteos.definicionesAtributo} definiciones
              de atributo. El vertical no se podrá cambiar después.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted">Moneda base *</span>
              <select
                required
                value={form.monedaBaseId}
                onChange={(e) => setField('monedaBaseId', e.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink"
              >
                {monedas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigoIso} — {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted">Moneda de presentación</span>
              <select
                value={form.monedaPresentacionId}
                onChange={(e) => setField('monedaPresentacionId', e.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink"
              >
                <option value="">Ninguna</option>
                {monedas
                  .filter((m) => m.id !== form.monedaBaseId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigoIso} — {m.nombre}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Zona horaria *"
              value={form.zonaHoraria}
              onChange={(v) => setField('zonaHoraria', v)}
              required
            />
            <Campo
              label="Locale *"
              value={form.locale}
              onChange={(v) => setField('locale', v)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.usaIa}
              onChange={(e) => setField('usaIa', e.target.checked)}
              className="size-4"
            />
            Usar IA para precotización
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Umbral automático"
              value={form.umbralAutomatico}
              onChange={(v) => setField('umbralAutomatico', v)}
            />
            <Campo
              label="Umbral de descarte"
              value={form.umbralDescarte}
              onChange={(v) => setField('umbralDescarte', v)}
            />
          </div>
          <p className="text-xs text-muted">
            Por encima del umbral automático la línea sale en verde; por debajo del
            de descarte, en rojo; entre ambos, en ámbar.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Sucursal principal — nombre"
              value={form.sucursalNombre}
              onChange={(v) => setField('sucursalNombre', v)}
            />
            <Campo
              label="Sucursal principal — código"
              value={form.sucursalCodigo}
              onChange={(v) => setField('sucursalCodigo', v)}
            />
          </div>
        </section>

        {error && <p className="text-sm text-peligro">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 rounded-md bg-teal px-5 text-sm font-semibold text-white hover:bg-teal/90 disabled:opacity-60"
        >
          {enviando ? 'Creando…' : 'Crear y provisionar'}
        </button>
      </form>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-borde bg-paper px-3 text-ink"
      />
    </label>
  );
}
