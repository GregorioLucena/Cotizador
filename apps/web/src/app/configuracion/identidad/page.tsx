'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiClientError,
  apiBaseUrl,
  apiFetch,
  getAccessToken,
} from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, Field, SelectField, TextField } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type OrgConfig = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  identificacionFiscal: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logoUrl: string | null;
  monedaBase: { id: string; codigoIso: string };
  monedaPresentacion: { id: string; codigoIso: string } | null;
  zonaHoraria: string;
  locale: string;
  usaIa: boolean;
  umbralAutomatico: string;
  umbralDescarte: string;
};

type Moneda = { id: string; codigoIso: string; nombre: string };

export default function IdentidadPage() {
  const router = useRouter();
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmarMoneda, setConfirmarMoneda] = useState(false);

  async function cargar() {
    const [o, m] = await Promise.all([
      apiFetch<OrgConfig>('/configuracion-organizacion'),
      apiFetch<Moneda[]>('/monedas'),
    ]);
    setOrg(o);
    setMonedas(m);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void cargar().catch((err) => {
      setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
    });
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!org) return;
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const monedaBaseId = String(fd.get('monedaBaseId'));
    const body = {
      nombre: String(fd.get('nombre')),
      razonSocial: String(fd.get('razonSocial') || '') || null,
      identificacionFiscal: String(fd.get('identificacionFiscal') || '') || null,
      telefono: String(fd.get('telefono') || '') || null,
      email: String(fd.get('email') || '') || null,
      direccion: String(fd.get('direccion') || '') || null,
      monedaBaseId,
      monedaPresentacionId: String(fd.get('monedaPresentacionId') || '') || null,
      zonaHoraria: String(fd.get('zonaHoraria')),
      locale: String(fd.get('locale')),
      usaIa: fd.get('usaIa') === 'on',
      umbralAutomatico: String(fd.get('umbralAutomatico')),
      umbralDescarte: String(fd.get('umbralDescarte')),
      ...(monedaBaseId !== org.monedaBase.id
        ? { confirmarCambioMonedaBase: confirmarMoneda }
        : {}),
    };
    try {
      const data = await apiFetch<{ organizacion: OrgConfig; advertencias: unknown[] }>(
        '/configuracion-organizacion',
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      setOrg(data.organizacion);
      setMsg('Configuración guardada.');
      setConfirmarMoneda(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar');
    } finally {
      setPending(false);
    }
  }

  async function onLogo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem('archivo') as HTMLInputElement;
    if (!input.files?.[0]) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('archivo', input.files[0]);
      const token = getAccessToken();
      const res = await fetch(`${apiBaseUrl()}/configuracion-organizacion/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new ApiClientError(
          json?.error?.code ?? 'HTTP_ERROR',
          json?.error?.message ?? 'Error al subir logo',
          res.status,
        );
      }
      setOrg(json.data);
      setMsg('Logo actualizado.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al subir');
    } finally {
      setPending(false);
    }
  }

  if (!org) {
    return (
      <AppShell nav="organizacion">
        <p className="py-16 text-center text-sm text-muted">{error ?? 'Cargando…'}</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="sm">
      <PageHeader
        eyebrow={<BackLink href="/configuracion">← Configuración</BackLink>}
        title="Identidad"
        description="Datos del negocio visibles en documentos y panel."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <Card accent>
          <CardHeader title="Datos del negocio" />
          <CardBody className="space-y-4">
            {(
              [
                ['nombre', 'Nombre', org.nombre, true],
                ['razonSocial', 'Razón social', org.razonSocial ?? '', false],
                [
                  'identificacionFiscal',
                  'Identificación fiscal',
                  org.identificacionFiscal ?? '',
                  false,
                ],
                ['telefono', 'Teléfono', org.telefono ?? '', false],
                ['email', 'Correo', org.email ?? '', false],
                ['direccion', 'Dirección', org.direccion ?? '', false],
              ] as const
            ).map(([name, label, value, required]) => (
              <TextField
                key={name}
                name={name}
                label={label}
                defaultValue={value}
                required={required}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Monedas y locale" />
          <CardBody className="space-y-4">
            <SelectField
              name="monedaBaseId"
              label="Moneda base"
              defaultValue={org.monedaBase.id}
              onChange={() => setConfirmarMoneda(false)}
            >
              {monedas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigoIso} — {m.nombre}
                </option>
              ))}
            </SelectField>
            <SelectField
              name="monedaPresentacionId"
              label="Moneda de presentación"
              defaultValue={org.monedaPresentacion?.id ?? ''}
            >
              <option value="">Ninguna</option>
              {monedas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigoIso} — {m.nombre}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="zonaHoraria"
                label="Zona horaria"
                defaultValue={org.zonaHoraria}
                required
              />
              <TextField name="locale" label="Locale" defaultValue={org.locale} required />
            </div>
            <CheckField
              label="Confirmo el cambio de moneda base (no reconvierte precios existentes)"
              checked={confirmarMoneda}
              onChange={(ev) => setConfirmarMoneda(ev.target.checked)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Interpretación"
            description="La IA solo lee el pedido; los precios salen del catálogo."
          />
          <CardBody className="space-y-4">
            <CheckField name="usaIa" label="Usar IA en la interpretación" defaultChecked={org.usaIa} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                name="umbralAutomatico"
                label="Umbral automático"
                defaultValue={org.umbralAutomatico}
                required
              />
              <TextField
                name="umbralDescarte"
                label="Umbral descarte"
                defaultValue={org.umbralDescarte}
                required
              />
            </div>
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>

      <form onSubmit={onLogo} className="mt-8">
        <Card>
          <CardHeader title="Logo" description="PNG, JPEG o SVG." />
          <CardBody className="space-y-4">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${apiBaseUrl().replace(/\/api\/?$/, '')}${org.logoUrl}`}
                alt="Logo"
                className="h-20 w-20 rounded-xl border border-borde bg-paper object-contain p-2"
              />
            ) : (
              <p className="text-sm text-muted">Sin logo todavía</p>
            )}
            <Field label="Archivo" htmlFor="archivo">
              <Input
                id="archivo"
                name="archivo"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="file:mr-3 file:rounded-lg file:border-0 file:bg-teal/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal"
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={pending}>
              Subir logo
            </Button>
          </CardBody>
        </Card>
      </form>
    </AppShell>
  );
}
