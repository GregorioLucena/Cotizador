'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, SelectField, TextField } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';

type ListaOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  esPredeterminada: boolean;
};

type CotizacionResumen = {
  id: string;
  folio: string;
  estado: string;
  total: string;
  createdAt: string;
};

type ClienteDetalle = {
  id: string;
  nombre: string;
  telefonoWhatsapp: string | null;
  email: string | null;
  identificacionFiscal: string | null;
  listaPrecio: { id: string; codigo: string; nombre: string } | null;
  direccion: string | null;
  notas: string | null;
  estadoRegistro: string;
  updatedAt: string;
  cotizacionesRecientes?: CotizacionResumen[];
};

export default function ClienteFichaPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [listas, setListas] = useState<ListaOpcion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const puedeEditar =
    contexto && hasPermission(contexto, PERMISOS.CLIENTES_EDITAR);

  const cargar = useCallback(async (ctx: OrgContext) => {
    const data = await apiFetch<ClienteDetalle>(`/clientes/${id}`);
    setCliente(data);
    if (hasPermission(ctx, PERMISOS.PRECIOS_LISTAS_VER)) {
      const res = await apiFetch<{ items: ListaOpcion[] }>(
        '/listas-precio?estadoRegistro=ACTIVO&limit=100',
      );
      setListas(res.items);
    }
  }, [id]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.CLIENTES_VER)) {
          setError('No tiene permiso para ver clientes.');
          return;
        }
        setContexto(perfil.contexto);
        await cargar(perfil.contexto);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
      }
    })();
  }, [cargar, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!puedeEditar || !cliente) return;
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const listaPrecioId = String(fd.get('listaPrecioId') || '');
    try {
      const data = await apiFetch<ClienteDetalle>(`/clientes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: String(fd.get('nombre')).trim(),
          telefonoWhatsapp: String(fd.get('telefonoWhatsapp') || '').trim() || null,
          email: String(fd.get('email') || '').trim() || null,
          identificacionFiscal:
            String(fd.get('identificacionFiscal') || '').trim() || null,
          listaPrecioId: listaPrecioId || null,
          direccion: String(fd.get('direccion') || '').trim() || null,
          notas: String(fd.get('notas') || '').trim() || null,
        }),
      });
      setCliente((prev) => ({
        ...data,
        cotizacionesRecientes: prev?.cotizacionesRecientes,
      }));
      setMsg('Cliente actualizado.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo guardar.');
    } finally {
      setPending(false);
    }
  }

  async function cambiarEstado(nuevo: 'ACTIVO' | 'INACTIVO') {
    if (!puedeEditar) return;
    setPending(true);
    setError(null);
    setMsg(null);
    try {
      const data = await apiFetch<ClienteDetalle>(`/clientes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estadoRegistro: nuevo }),
      });
      setCliente((prev) => ({
        ...data,
        cotizacionesRecientes: prev?.cotizacionesRecientes,
      }));
      setMsg(
        nuevo === 'INACTIVO'
          ? 'Cliente inactivado. No aparecerá en capturas nuevas.'
          : 'Cliente reactivado.',
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo cambiar el estado.',
      );
    } finally {
      setPending(false);
    }
  }

  if (!cliente && !error) {
    return (
      <AppShell nav="organizacion" maxWidth="sm">
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  if (error && !cliente) {
    return (
      <AppShell nav="organizacion" maxWidth="sm">
        <StatusBanner tone="error">{error}</StatusBanner>
        <BackLink href="/clientes">← Clientes</BackLink>
      </AppShell>
    );
  }

  if (!cliente) return null;

  const mostrarCotizaciones = Array.isArray(cliente.cotizacionesRecientes);

  return (
    <AppShell nav="organizacion" maxWidth="sm">
      <PageHeader
        eyebrow={<BackLink href="/clientes">← Clientes</BackLink>}
        title={cliente.nombre}
        description="Ficha del cliente. Las notas son solo uso interno."
        action={
          cliente.estadoRegistro === 'INACTIVO' ? (
            <Badge className="bg-peligro/10 text-peligro">Inactivo</Badge>
          ) : undefined
        }
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
          defaultValue={cliente.nombre}
          disabled={!puedeEditar}
          key={`nombre-${cliente.updatedAt}`}
        />
        <TextField
          label="WhatsApp"
          name="telefonoWhatsapp"
          placeholder="+584141234567"
          maxLength={20}
          defaultValue={cliente.telefonoWhatsapp ?? ''}
          disabled={!puedeEditar}
          key={`wa-${cliente.updatedAt}`}
        />
        <TextField
          label="Correo"
          name="email"
          type="email"
          maxLength={254}
          defaultValue={cliente.email ?? ''}
          disabled={!puedeEditar}
          key={`email-${cliente.updatedAt}`}
        />
        <TextField
          label="Identificación fiscal"
          name="identificacionFiscal"
          maxLength={40}
          defaultValue={cliente.identificacionFiscal ?? ''}
          disabled={!puedeEditar}
          key={`rif-${cliente.updatedAt}`}
        />
        <SelectField
          label="Lista de precios"
          name="listaPrecioId"
          defaultValue={cliente.listaPrecio?.id ?? ''}
          disabled={!puedeEditar}
          key={`lista-${cliente.updatedAt}`}
        >
          <option value="">Predeterminada de la organización</option>
          {listas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} — {l.nombre}
            </option>
          ))}
          {cliente.listaPrecio &&
          !listas.some((l) => l.id === cliente.listaPrecio!.id) ? (
            <option value={cliente.listaPrecio.id}>
              {cliente.listaPrecio.codigo} — {cliente.listaPrecio.nombre}
            </option>
          ) : null}
        </SelectField>
        <TextField
          label="Dirección"
          name="direccion"
          maxLength={300}
          defaultValue={cliente.direccion ?? ''}
          disabled={!puedeEditar}
          key={`dir-${cliente.updatedAt}`}
        />
        <Field label="Notas internas" htmlFor="notas">
          <Textarea
            id="notas"
            name="notas"
            maxLength={2000}
            defaultValue={cliente.notas ?? ''}
            disabled={!puedeEditar}
            key={`notas-${cliente.updatedAt}`}
          />
        </Field>

        {puedeEditar ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            {cliente.estadoRegistro === 'ACTIVO' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void cambiarEstado('INACTIVO')}
              >
                Inactivar
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void cambiarEstado('ACTIVO')}
              >
                Reactivar
              </Button>
            )}
          </div>
        ) : null}
      </form>

      {mostrarCotizaciones ? (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-ink">
            Cotizaciones recientes
          </h2>
          {!cliente.cotizacionesRecientes?.length ? (
            <p className="mt-3 text-sm text-muted">
              Aún no hay cotizaciones asociadas a este cliente.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {cliente.cotizacionesRecientes.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-borde/80 bg-surface px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold text-ink">{c.folio}</span>
                    <span className="ml-2 text-muted">{c.estado}</span>
                  </span>
                  <span className="text-muted">{c.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
