'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
  setAccessToken,
} from '@/lib/api';
import type {
  MonedaOpcion,
  OrganizacionDetalle,
  OrganizacionDetalleRespuesta,
} from '@/lib/organizaciones';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import {
  CheckField,
  Field,
  FormRequiredLegend,
  SelectField,
  TextField,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type RefreshData = {
  accessToken: string;
  debeCambiarPassword: boolean;
};

type FormState = {
  nombre: string;
  razonSocial: string;
  identificacionFiscal: string;
  telefono: string;
  email: string;
  direccion: string;
  monedaBaseId: string;
  monedaPresentacionId: string;
  zonaHoraria: string;
  locale: string;
  usaIa: boolean;
  umbralAutomatico: string;
  umbralDescarte: string;
  notasInternas: string;
};

function formDesdeOrg(org: OrganizacionDetalle): FormState {
  return {
    nombre: org.nombre,
    razonSocial: org.razonSocial ?? '',
    identificacionFiscal: org.identificacionFiscal ?? '',
    telefono: org.telefono ?? '',
    email: org.email ?? '',
    direccion: org.direccion ?? '',
    monedaBaseId: org.monedaBase.id,
    monedaPresentacionId: org.monedaPresentacion?.id ?? '',
    zonaHoraria: org.zonaHoraria,
    locale: org.locale,
    usaIa: org.usaIa,
    umbralAutomatico: org.umbralAutomatico,
    umbralDescarte: org.umbralDescarte,
    notasInternas: org.notasInternas ?? '',
  };
}

export default function EditarOrganizacionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [org, setOrg] = useState<OrganizacionDetalle | null>(null);
  const [monedas, setMonedas] = useState<MonedaOpcion[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

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

        const [detalle, mons] = await Promise.all([
          apiFetch<OrganizacionDetalleRespuesta>(`/organizaciones/${id}`),
          apiFetch<MonedaOpcion[]>('/monedas'),
        ]);
        if (cancelled) return;
        setOrg(detalle.organizacion);
        setForm(formDesdeOrg(detalle.organizacion));
        setMonedas(mons);
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
            : 'No se pudo cargar la organización.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void cargar();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !org) return;
    setError(null);
    setEnviando(true);

    try {
      const body: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        razonSocial: form.razonSocial.trim() || null,
        identificacionFiscal: form.identificacionFiscal.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        direccion: form.direccion.trim() || null,
        monedaBaseId: form.monedaBaseId,
        monedaPresentacionId: form.monedaPresentacionId || null,
        zonaHoraria: form.zonaHoraria.trim(),
        locale: form.locale.trim(),
        usaIa: form.usaIa,
        umbralAutomatico: form.umbralAutomatico,
        umbralDescarte: form.umbralDescarte,
        notasInternas: form.notasInternas.trim() || null,
      };

      if (form.monedaBaseId !== org.monedaBase.id) {
        body.confirmarCambioMonedaBase = true;
      }

      await apiFetch(`/organizaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      router.replace(`/plataforma/organizaciones/${id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo guardar los cambios.',
      );
      setEnviando(false);
    }
  }

  if (loading || !form || !org) {
    return (
      <AppShell nav="plataforma">
        {error ? (
          <div className="py-10">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted">Cargando…</p>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell nav="plataforma">
      <PageHeader
        eyebrow={
          <BackLink href={`/plataforma/organizaciones/${id}`}>
            ← {org.nombre}
          </BackLink>
        }
        title="Editar organización"
        description="El vertical no se puede cambiar porque la organización ya fue provisionada."
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
          <CardHeader title="Configuración" />
          <CardBody className="space-y-4">
            <Field label="Vertical">
              <Input
                value={`${org.vertical.nombre} (${org.vertical.codigo})`}
                disabled
                readOnly
                aria-describedby="vertical-bloqueado"
              />
              <p id="vertical-bloqueado" className="mt-1.5 text-xs text-muted">
                El vertical no se puede cambiar porque la organización ya fue
                provisionada.
              </p>
            </Field>

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
                onChange={(e) =>
                  setField('monedaPresentacionId', e.target.value)
                }
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
            {form.monedaBaseId !== org.monedaBase.id ? (
              <p className="rounded-xl bg-ambar/10 px-3 py-2 text-xs text-slate">
                Cambiar la moneda base afecta cómo se interpretan los precios
                existentes. Confirma al guardar.
              </p>
            ) : null}

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
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Link
            href={`/plataforma/organizaciones/${id}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/40"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
