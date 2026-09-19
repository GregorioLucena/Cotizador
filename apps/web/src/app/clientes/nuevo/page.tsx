'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Field, SelectField, TextField } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';

type ListaOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  esPredeterminada: boolean;
};

type ClienteCreado = {
  id: string;
  advertencias?: string[];
};

export default function NuevoClientePage() {
  const router = useRouter();
  const [listas, setListas] = useState<ListaOpcion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [listo, setListo] = useState(false);

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
        if (!hasPermission(perfil.contexto, PERMISOS.CLIENTES_CREAR)) {
          setError('No tiene permiso para crear clientes.');
          return;
        }
        if (hasPermission(perfil.contexto, PERMISOS.PRECIOS_LISTAS_VER)) {
          const res = await apiFetch<{ items: ListaOpcion[] }>(
            '/listas-precio?estadoRegistro=ACTIVO&limit=100',
          );
          setListas(res.items);
        }
        setListo(true);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
      }
    })();
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const listaPrecioId = String(fd.get('listaPrecioId') || '');
    const telefono = String(fd.get('telefonoWhatsapp') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const identificacionFiscal = String(fd.get('identificacionFiscal') || '').trim();
    const direccion = String(fd.get('direccion') || '').trim();
    const notas = String(fd.get('notas') || '').trim();

    try {
      const data = await apiFetch<ClienteCreado>('/clientes', {
        method: 'POST',
        body: JSON.stringify({
          nombre: String(fd.get('nombre')).trim(),
          telefonoWhatsapp: telefono || null,
          email: email || null,
          identificacionFiscal: identificacionFiscal || null,
          listaPrecioId: listaPrecioId || null,
          direccion: direccion || null,
          notas: notas || null,
        }),
      });
      if (data.advertencias?.includes('CLIENTE_REUTILIZADO_POR_WHATSAPP')) {
        setMsg('Se usó el cliente existente con ese WhatsApp.');
      }
      router.push(`/clientes/${data.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo crear.');
    } finally {
      setPending(false);
    }
  }

  if (!listo) {
    return (
      <AppShell nav="organizacion">
        {error ? (
          <StatusBanner tone="error">{error}</StatusBanner>
        ) : (
          <p className="py-16 text-center text-sm text-muted">Cargando…</p>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="sm">
      <PageHeader
        eyebrow={<BackLink href="/clientes">← Clientes</BackLink>}
        title="Nuevo cliente"
        description="El WhatsApp debe ir con código de país (+58…). Sin lista se usará la predeterminada al cotizar."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
        <TextField
          label="Nombre"
          name="nombre"
          required
          minLength={2}
          maxLength={160}
        />
        <TextField
          label="WhatsApp"
          name="telefonoWhatsapp"
          placeholder="+584141234567"
          maxLength={20}
        />
        <TextField label="Correo" name="email" type="email" maxLength={254} />
        <TextField
          label="Identificación fiscal"
          name="identificacionFiscal"
          maxLength={40}
        />
        <SelectField label="Lista de precios" name="listaPrecioId" defaultValue="">
          <option value="">Predeterminada de la organización</option>
          {listas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} — {l.nombre}
              {l.esPredeterminada ? ' (predeterminada)' : ''}
            </option>
          ))}
        </SelectField>
        <TextField label="Dirección" name="direccion" maxLength={300} />
        <Field label="Notas internas" htmlFor="notas">
          <Textarea id="notas" name="notas" maxLength={2000} />
        </Field>
        <p className="text-xs text-muted">
          Las notas no aparecen en el PDF ni en el texto para WhatsApp.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Crear cliente'}
        </Button>
      </form>
    </AppShell>
  );
}
