'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Tags } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckField, TextField } from '@/components/ui/field';

type Lista = {
  id: string;
  nombre: string;
  codigo: string;
  monedaId: string;
  esPredeterminada: boolean;
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  estadoRegistro: string;
};

type OrgConfig = {
  monedaBase: { id: string; codigoIso: string };
};

export default function PreciosPage() {
  const router = useRouter();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [monedaBaseId, setMonedaBaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);

  const puedeAdmin =
    contexto && hasPermission(contexto, PERMISOS.PRECIOS_LISTAS_ADMINISTRAR);
  const puedeReglas =
    contexto && hasPermission(contexto, PERMISOS.PRECIOS_REGLAS_ADMINISTRAR);
  const puedeTasas =
    contexto && hasPermission(contexto, PERMISOS.PRECIOS_TASAS_ADMINISTRAR);

  async function cargar() {
    const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
    if (perfil.contexto.ambito !== 'ORGANIZACION') {
      router.replace('/panel');
      return;
    }
    if (!hasPermission(perfil.contexto, PERMISOS.PRECIOS_LISTAS_VER)) {
      setError('No tiene permiso para ver listas de precios.');
      setContexto(perfil.contexto);
      return;
    }
    setContexto(perfil.contexto);
    const listasRes = await apiFetch<{ items: Lista[] }>(
      '/listas-precio?estadoRegistro=TODOS&limit=100',
    );
    setListas(listasRes.items);

    if (hasPermission(perfil.contexto, PERMISOS.PRECIOS_LISTAS_ADMINISTRAR)) {
      try {
        const org = await apiFetch<OrgConfig>('/configuracion-organizacion');
        setMonedaBaseId(org.monedaBase.id);
      } catch {
        /* moneda se pide al crear si hace falta */
      }
    }
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
    if (!monedaBaseId) return;
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/listas-precio', {
        method: 'POST',
        body: JSON.stringify({
          nombre: String(fd.get('nombre')),
          codigo: String(fd.get('codigo')),
          monedaId: monedaBaseId,
          esPredeterminada: fd.get('esPredeterminada') === 'on',
        }),
      });
      setShowForm(false);
      setMsg('Lista creada.');
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
      <PageHeader
        title="Precios"
        description="Listas, precios por item, reglas de descuento y tasas de cambio."
        action={
          puedeAdmin ? (
            <Button type="button" onClick={() => setShowForm((v) => !v)}>
              <Plus className="size-4" />
              Nueva lista
            </Button>
          ) : undefined
        }
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

      <div className="mb-6 flex flex-wrap gap-3">
        {puedeReglas ? (
          <Link
            href="/precios/reglas"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/35"
          >
            <Tags className="size-4 text-teal" />
            Reglas de descuento
          </Link>
        ) : null}
        {puedeTasas ? (
          <Link
            href="/precios/tasas"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borde bg-surface px-4 text-sm font-semibold text-ink hover:border-teal/35"
          >
            Tasas de cambio
          </Link>
        ) : null}
      </div>

      {showForm && puedeAdmin ? (
        <form
          onSubmit={(e) => void onCrear(e)}
          className="mb-6 space-y-3 rounded-2xl border border-borde bg-surface p-4"
        >
          <TextField label="Nombre" name="nombre" required minLength={2} maxLength={80} />
          <TextField
            label="Código"
            name="codigo"
            required
            minLength={2}
            maxLength={20}
            placeholder="MAYOR"
          />
          <p className="-mt-2 text-xs text-muted">Se normaliza a mayúsculas</p>
          <CheckField label="Marcar como predeterminada" name="esPredeterminada" />
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Crear lista'}
          </Button>
        </form>
      ) : null}

      {listas.length === 0 ? (
        <StatusBanner tone="info">Aún no hay listas de precios.</StatusBanner>
      ) : (
        <ul className="space-y-2">
          {listas.map((l) => (
            <li key={l.id}>
              <Link
                href={`/precios/${l.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-borde/80 bg-surface px-4 py-3.5 transition hover:border-teal/35"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-ink">
                      {l.nombre}
                    </span>
                    <Badge>{l.codigo}</Badge>
                    {l.esPredeterminada ? (
                      <Badge className="bg-teal/15 text-teal-deep">Predeterminada</Badge>
                    ) : null}
                    {l.estadoRegistro === 'INACTIVO' ? (
                      <Badge className="bg-peligro/10 text-peligro">Inactiva</Badge>
                    ) : null}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted group-hover:text-teal" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
