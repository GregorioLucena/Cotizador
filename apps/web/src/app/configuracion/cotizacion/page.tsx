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
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckField, SelectField, TextField } from '@/components/ui/field';

type Cfg = {
  id: string;
  vigenciaHorasPredeterminada: number;
  aplicaImpuesto: boolean;
  porcentajeImpuesto: string;
  preciosIncluyenImpuesto: boolean;
  decimalesRedondeo: number;
  modoRedondeo: string;
  mostrarDescuentoDetallado: boolean;
  permiteSobrescribirPrecio: boolean;
  listaPrecioPredeterminada: { id: string; nombre: string } | null;
};

export default function CotizacionConfigPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void apiFetch<Cfg>('/configuracion-cotizacion')
      .then(setCfg)
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : 'Error');
      });
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cfg) return;
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<Cfg>('/configuracion-cotizacion', {
        method: 'PATCH',
        body: JSON.stringify({
          vigenciaHorasPredeterminada: Number(fd.get('vigenciaHorasPredeterminada')),
          aplicaImpuesto: fd.get('aplicaImpuesto') === 'on',
          porcentajeImpuesto: String(fd.get('porcentajeImpuesto')),
          preciosIncluyenImpuesto: fd.get('preciosIncluyenImpuesto') === 'on',
          decimalesRedondeo: Number(fd.get('decimalesRedondeo')),
          modoRedondeo: String(fd.get('modoRedondeo')),
          mostrarDescuentoDetallado: fd.get('mostrarDescuentoDetallado') === 'on',
          permiteSobrescribirPrecio: fd.get('permiteSobrescribirPrecio') === 'on',
          ...(cfg.listaPrecioPredeterminada
            ? { listaPrecioPredeterminadaId: cfg.listaPrecioPredeterminada.id }
            : {}),
        }),
      });
      setCfg(data);
      setMsg('Configuración de cotización guardada.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  if (!cfg) {
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
        title="Cotización"
        description={`No modifica cotizaciones ya aprobadas. Lista predeterminada: ${cfg.listaPrecioPredeterminada?.nombre ?? '—'}`}
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <Card accent>
          <CardHeader title="Vigencia e impuesto" />
          <CardBody className="space-y-4">
            <TextField
              id="vigencia"
              name="vigenciaHorasPredeterminada"
              label="Vigencia predeterminada (horas)"
              type="number"
              min={1}
              max={8760}
              defaultValue={cfg.vigenciaHorasPredeterminada}
            />
            <CheckField
              name="aplicaImpuesto"
              label="Aplicar impuesto"
              defaultChecked={cfg.aplicaImpuesto}
            />
            <TextField
              id="pct"
              name="porcentajeImpuesto"
              label="Porcentaje de impuesto"
              defaultValue={cfg.porcentajeImpuesto}
            />
            <CheckField
              name="preciosIncluyenImpuesto"
              label="Precios incluyen impuesto"
              defaultChecked={cfg.preciosIncluyenImpuesto}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Redondeo y opciones" />
          <CardBody className="space-y-4">
            <TextField
              id="dec"
              name="decimalesRedondeo"
              label="Decimales de redondeo"
              type="number"
              min={0}
              max={4}
              defaultValue={cfg.decimalesRedondeo}
            />
            <SelectField
              id="modo"
              name="modoRedondeo"
              label="Modo de redondeo"
              defaultValue={cfg.modoRedondeo}
            >
              <option value="NORMAL">Normal</option>
              <option value="ARRIBA">Arriba</option>
              <option value="ABAJO">Abajo</option>
            </SelectField>
            <CheckField
              name="mostrarDescuentoDetallado"
              label="Mostrar descuento detallado"
              defaultChecked={cfg.mostrarDescuentoDetallado}
            />
            <CheckField
              name="permiteSobrescribirPrecio"
              label="Permitir sobrescribir precio"
              defaultChecked={cfg.permiteSobrescribirPrecio}
            />
          </CardBody>
        </Card>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </AppShell>
  );
}
