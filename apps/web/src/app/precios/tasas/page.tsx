'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { useToast } from '@/components/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormRequiredLegend, SelectField, TextField } from '@/components/ui/field';

type Tasa = {
  id: string;
  monedaOrigenId: string;
  monedaDestinoId: string;
  valor: string;
  fechaVigencia: string;
  fuente: string;
  estadoRegistro: string;
};

type Moneda = { id: string; codigoIso: string; nombre: string };

function diasDesde(fecha: string, hoy: string): number {
  const a = new Date(`${fecha}T00:00:00Z`).getTime();
  const b = new Date(`${hoy}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

export default function TasasCambioPage() {
  const router = useRouter();
  const toast = useToast();
  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [tasas, setTasas] = useState<Tasa[]>([]);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);

  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const ultimaFecha = tasas[0]?.fechaVigencia ?? null;
  const tasaAntigua =
    ultimaFecha != null ? diasDesde(ultimaFecha, hoy) > 1 : false;

  const monedaLabel = (id: string) =>
    monedas.find((m) => m.id === id)?.codigoIso ?? id.slice(0, 8);

  async function cargar() {
    const perfil = await apiFetch<{ contexto: OrgContext }>('/auth/perfil');
    if (perfil.contexto.ambito !== 'ORGANIZACION') {
      router.replace('/panel');
      return;
    }
    if (!hasPermission(perfil.contexto, PERMISOS.PRECIOS_TASAS_ADMINISTRAR)) {
      setError('No tiene permiso para administrar tasas.');
      setContexto(perfil.contexto);
      return;
    }
    setContexto(perfil.contexto);
    const [t, m] = await Promise.all([
      apiFetch<{ items: Tasa[] }>('/tasas-cambio?estadoRegistro=TODOS&limit=50'),
      apiFetch<Moneda[]>('/monedas'),
    ]);
    setTasas(t.items);
    setMonedas(m);
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
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/tasas-cambio', {
        method: 'POST',
        body: JSON.stringify({
          monedaOrigenId: String(fd.get('monedaOrigenId')),
          monedaDestinoId: String(fd.get('monedaDestinoId')),
          valor: String(fd.get('valor')),
          fechaVigencia: String(fd.get('fechaVigencia')),
          fuente: 'MANUAL',
        }),
      });
      setShowForm(false);
      toast.success('Tasa creada.');
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
        title="Tasas de cambio"
        description="Conversión solo del total de la cotización. Fuente MANUAL en el MVP."
        action={
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            Nueva tasa
          </Button>
        }
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      {tasaAntigua ? (
        <StatusBanner tone="info">
          La tasa de cambio tiene más de un día; verifique antes de aprobar.
        </StatusBanner>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void onCrear(e)}
          className="mb-6 space-y-3 rounded-2xl border border-borde bg-surface p-4"
        >
          <FormRequiredLegend />
          <SelectField label="Moneda origen" name="monedaOrigenId" required>
            <option value="">Seleccione…</option>
            {monedas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigoIso} — {m.nombre}
              </option>
            ))}
          </SelectField>
          <SelectField label="Moneda destino" name="monedaDestinoId" required>
            <option value="">Seleccione…</option>
            {monedas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigoIso} — {m.nombre}
              </option>
            ))}
          </SelectField>
          <TextField label="Valor" name="valor" required placeholder="36.500000" />
          <TextField
            label="Fecha vigencia"
            name="fechaVigencia"
            type="date"
            required
            defaultValue={hoy}
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Crear'}
          </Button>
        </form>
      ) : null}

      <ul className="space-y-2">
        {tasas.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde/80 bg-surface px-4 py-3"
          >
            <div>
              <p className="font-semibold text-ink">
                {monedaLabel(t.monedaOrigenId)} → {monedaLabel(t.monedaDestinoId)}
              </p>
              <p className="text-sm text-muted">
                {t.valor} · vigencia {t.fechaVigencia}
              </p>
            </div>
            <Badge>{t.fuente}</Badge>
          </li>
        ))}
      </ul>
      {tasas.length === 0 ? (
        <StatusBanner tone="info">No hay tasas registradas.</StatusBanner>
      ) : null}
    </AppShell>
  );
}
