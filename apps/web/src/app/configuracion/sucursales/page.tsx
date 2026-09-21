'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, apiFetch, getAccessToken } from '@/lib/api';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { useToast } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { FormRequiredLegend } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type Sucursal = {
  id: string;
  nombre: string;
  codigo: string | null;
  esPrincipal: boolean;
  estadoRegistro: string;
  usuariosAsignados: number;
};

type Listado = {
  items: Sucursal[];
  meta: { page: number; total: number };
};

export default function SucursalesPage() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Listado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await apiFetch<Listado>('/sucursales?estadoRegistro=TODOS');
    setData(res);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void cargar().catch((err) => {
      setError(err instanceof ApiClientError ? err.message : 'Error');
    });
  }, [router]);

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/sucursales', {
        method: 'POST',
        body: JSON.stringify({
          nombre: String(fd.get('nombre')),
          codigo: String(fd.get('codigo')),
        }),
      });
      (e.target as HTMLFormElement).reset();
      toast.success('Sucursal creada.');
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error');
    }
  }

  async function toggle(s: Sucursal) {
    setError(null);
    try {
      await apiFetch(`/sucursales/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          estadoRegistro: s.estadoRegistro === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
        }),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error');
    }
  }

  return (
    <AppShell nav="organizacion">
      <PageHeader
        eyebrow={<BackLink href="/configuracion">← Configuración</BackLink>}
        title="Sucursales"
        description="Puntos de venta y depósitos de la organización."
      />

      <Card accent className="mb-5">
        <CardHeader title="Nueva sucursal" />
        <CardBody>
          <form onSubmit={crear} className="space-y-3">
            <FormRequiredLegend />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input name="nombre" required placeholder="Nombre" className="flex-1" />
              <Input name="codigo" required placeholder="Código" className="sm:w-28" />
              <Button type="submit" className="sm:shrink-0">
                Crear
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {error ? <div className="mb-4"><StatusBanner tone="error">{error}</StatusBanner></div> : null}

      <ul className="space-y-3">
        {data?.items.map((s) => (
          <li key={s.id}>
            <Card>
              <CardBody className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-bold text-ink">{s.nombre}</p>
                    <span className="text-xs text-muted">({s.codigo})</span>
                    {s.esPrincipal ? <Badge tone="brand">Principal</Badge> : null}
                    <Badge tone={s.estadoRegistro === 'ACTIVO' ? 'success' : 'neutral'}>
                      {s.estadoRegistro}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {s.usuariosAsignados} usuario{s.usuariosAsignados === 1 ? '' : 's'}
                  </p>
                </div>
                {!s.esPrincipal ? (
                  <Button variant="secondary" onClick={() => void toggle(s)} className="shrink-0">
                    {s.estadoRegistro === 'ACTIVO' ? 'Inactivar' : 'Reactivar'}
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
