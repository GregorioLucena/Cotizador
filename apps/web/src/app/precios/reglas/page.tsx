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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';

type Regla = {
  id: string;
  nombre: string;
  ambito: string;
  tipoDescuento: string;
  valor: string;
  prioridad: number;
  cantidadMinima: string;
  estadoRegistro: string;
};

export default function ReglasDescuentoPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);

  async function cargar() {
    const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
    if (perfil.contexto.ambito !== 'ORGANIZACION') {
      router.replace('/panel');
      return;
    }
    if (!hasPermission(perfil.contexto, PERMISOS.PRECIOS_REGLAS_ADMINISTRAR)) {
      setError('No tiene permiso para administrar reglas.');
      setContexto(perfil.contexto);
      return;
    }
    setContexto(perfil.contexto);
    const data = await apiFetch<{ items: Regla[] }>(
      '/reglas-descuento?estadoRegistro=TODOS&limit=100',
    );
    setReglas(data.items);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void cargar().catch((err) => {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'Error al cargar');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onCrear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const ambito = String(fd.get('ambito'));
    const body: Record<string, unknown> = {
      nombre: String(fd.get('nombre')),
      ambito,
      tipoDescuento: String(fd.get('tipoDescuento')),
      valor: String(fd.get('valor')),
      prioridad: Number(fd.get('prioridad')),
      cantidadMinima: String(fd.get('cantidadMinima') || '1.0000'),
    };
    const ref = String(fd.get('referenciaId') || '').trim();
    if (ambito !== 'GLOBAL' && ref) body.referenciaId = ref;
    try {
      await apiFetch('/reglas-descuento', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setMsg('Regla creada.');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error al crear');
    } finally {
      setPending(false);
    }
  }

  if (!contexto && !error) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <p className="py-16 text-center text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <BackLink href="/precios">← Precios</BackLink>
      <PageHeader
        title="Reglas de descuento"
        description="Una sola regla por línea; desempate por prioridad, especificidad y beneficio."
        action={
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            Nueva regla
          </Button>
        }
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

      {showForm ? (
        <form
          onSubmit={(e) => void onCrear(e)}
          className="mb-6 space-y-3 rounded-2xl border border-borde bg-surface p-4"
        >
          <TextField label="Nombre" name="nombre" required minLength={2} maxLength={120} />
          <SelectField label="Ámbito" name="ambito" defaultValue="GLOBAL">
            <option value="GLOBAL">GLOBAL</option>
            <option value="ITEM">ITEM</option>
            <option value="CATEGORIA">CATEGORIA</option>
            <option value="MARCA">MARCA</option>
          </SelectField>
          <TextField
            label="Referencia (UUID)"
            name="referenciaId"
            placeholder="Obligatorio salvo GLOBAL"
          />
          <SelectField label="Tipo" name="tipoDescuento" defaultValue="PORCENTAJE">
            <option value="PORCENTAJE">PORCENTAJE</option>
            <option value="MONTO_FIJO">MONTO_FIJO</option>
            <option value="PRECIO_FIJO">PRECIO_FIJO</option>
          </SelectField>
          <TextField label="Valor" name="valor" required placeholder="10.0000" />
          <TextField
            label="Prioridad"
            name="prioridad"
            type="number"
            required
            defaultValue={10}
          />
          <TextField
            label="Cantidad mínima"
            name="cantidadMinima"
            defaultValue="1.0000"
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Crear'}
          </Button>
        </form>
      ) : null}

      <ul className="space-y-2">
        {reglas.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-borde/80 bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold text-ink">{r.nombre}</span>
              <Badge>{r.ambito}</Badge>
              <Badge tone="brand">prio {r.prioridad}</Badge>
              {r.estadoRegistro === 'INACTIVO' ? (
                <Badge tone="danger">Inactiva</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {r.tipoDescuento} {r.valor} · mín. {r.cantidadMinima}
            </p>
          </li>
        ))}
      </ul>
      {reglas.length === 0 ? (
        <StatusBanner tone="info">No hay reglas todavía.</StatusBanner>
      ) : null}
    </AppShell>
  );
}
