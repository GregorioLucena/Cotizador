'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  LOTE_CONFIRMACION_DEFAULT,
  PERMISOS,
  hasPermission,
  type OrgContext,
} from '@cotizador/shared';
import {
  ApiClientError,
  apiBaseUrl,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';

type Tipo = 'ITEMS' | 'PRECIOS' | 'ALIAS';

type ErrorFila = {
  fila: number;
  campo?: string;
  codigo: string;
  mensaje: string;
  valorRecibido?: string;
};

type Importacion = {
  id: string;
  tipo: Tipo;
  nombreArchivo: string;
  nombreHoja?: string | null;
  estado: string;
  filasTotales: number;
  filasValidas: number;
  filasConError: number;
  mapeoColumnas: Record<string, string | number>;
  erroresDetalle: ErrorFila[];
  resumen: {
    altas?: number;
    actualizaciones?: number;
    omitidas?: number;
    filasAplicadas?: number;
    filasOmitidas?: number;
    filasActualizadas?: number;
    advertencias?: string[];
    simulado?: boolean;
    confirmOffset?: number;
    progreso?: {
      procesadas: number;
      total: number;
      porcentaje: number;
      terminado: boolean;
    };
  } | null;
  createdAt: string;
};

type InspeccionArchivo = {
  formato: 'csv' | 'xlsx';
  hojas: Array<{ nombre: string; cabeceras: string[] }>;
  sugerida: string | null;
};

type Listado = {
  items: Importacion[];
  meta: { page: number; totalPages: number; total: number };
};

type PerfilAuth = {
  usuario: { id: string };
  contexto: OrgContext;
};

const CAMPOS_POR_TIPO: Record<Tipo, string[]> = {
  ITEMS: [
    'sku',
    'nombre',
    'descripcion',
    'categoria',
    'marca',
    'unidadCodigo',
    'tipoItem',
    'controlaStock',
    'stockAproximado',
    'precioLista',
    'listaPrecioCodigo',
    'alias',
  ],
  PRECIOS: ['sku', 'listaPrecioCodigo', 'precio'],
  ALIAS: ['sku', 'alias'],
};

const OBLIGATORIOS: Record<Tipo, string[]> = {
  ITEMS: ['nombre', 'unidadCodigo'],
  PRECIOS: ['sku', 'listaPrecioCodigo', 'precio'],
  ALIAS: ['sku', 'alias'],
};

export default function ImportarCatalogoPage() {
  const router = useRouter();
  const toast = useToast();
  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<Tipo>('ITEMS');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hojas, setHojas] = useState<Array<{ nombre: string; cabeceras: string[] }>>(
    [],
  );
  const [nombreHoja, setNombreHoja] = useState('');
  const [cabeceras, setCabeceras] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [actual, setActual] = useState<Importacion | null>(null);
  const [historial, setHistorial] = useState<Importacion[]>([]);
  const [confirmarCheck, setConfirmarCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progreso, setProgreso] = useState<{
    procesadas: number;
    total: number;
    porcentaje: number;
    etiqueta: string;
  } | null>(null);

  const campos = useMemo(() => CAMPOS_POR_TIPO[tipo], [tipo]);

  const cargarHistorial = useCallback(async () => {
    const data = await apiFetch<Listado>('/importaciones?limit=10');
    setHistorial(data.items);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void (async () => {
      try {
        const perfil = await apiFetch<PerfilAuth>('/auth/perfil');
        if (perfil.contexto.ambito !== 'ORGANIZACION') {
          router.replace('/panel');
          return;
        }
        if (!hasPermission(perfil.contexto, PERMISOS.CATALOGO_ITEMS_IMPORTAR)) {
          setError('No tiene permiso para importar catálogo.');
          return;
        }
        setAuth(perfil);
        await cargarHistorial();
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(err instanceof ApiClientError ? err.message : 'Error');
      }
    })();
  }, [cargarHistorial, router]);

  function aplicarCabeceras(cols: string[]) {
    setCabeceras(cols);
    const auto: Record<string, string> = {};
    for (const campo of CAMPOS_POR_TIPO[tipo]) {
      const hit = cols.find(
        (c) => c.toLowerCase() === campo.toLowerCase() || c === campo,
      );
      if (hit) auto[campo] = hit;
    }
    setMapeo(auto);
  }

  async function onArchivo(file: File | null) {
    setArchivo(file);
    setCabeceras([]);
    setHojas([]);
    setNombreHoja('');
    setMapeo({});
    setError(null);
    if (!file) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const insp = await apiFetch<InspeccionArchivo>('/importaciones/inspeccionar', {
        method: 'POST',
        body: fd,
      });
      setHojas(insp.hojas);
      const elegida = insp.sugerida ?? insp.hojas[0]?.nombre ?? '';
      setNombreHoja(elegida);
      const hoja = insp.hojas.find((h) => h.nombre === elegida) ?? insp.hojas[0];
      aplicarCabeceras(hoja?.cabeceras ?? []);
      if (insp.formato === 'xlsx') {
        toast.info(`Hoja sugerida: «${elegida}». Puede cambiarla si lo necesita.`);
      }
    } catch (err) {
      setArchivo(null);
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo leer el archivo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function onCambiarHoja(nombre: string) {
    setNombreHoja(nombre);
    const hoja = hojas.find((h) => h.nombre === nombre);
    aplicarCabeceras(hoja?.cabeceras ?? []);
  }

  async function descargarPlantilla() {
    const token = getAccessToken();
    const res = await fetch(
      `${apiBaseUrl()}/importaciones/plantilla?tipo=${tipo}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      },
    );
    if (!res.ok) {
      setError('No se pudo descargar la plantilla.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-${tipo.toLowerCase()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function cargar(e: FormEvent) {
    e.preventDefault();
    if (!archivo || !auth) return;
    for (const o of OBLIGATORIOS[tipo]) {
      if (!mapeo[o]) {
        setError(`Mapee el campo obligatorio «${o}».`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('tipo', tipo);
      fd.append('mapeoColumnas', JSON.stringify(mapeo));
      if (nombreHoja && !archivo.name.toLowerCase().endsWith('.csv')) {
        fd.append('nombreHoja', nombreHoja);
      }
      fd.append('archivo', archivo);
      const creada = await apiFetch<Importacion>('/importaciones', {
        method: 'POST',
        body: fd,
      });
      setActual(creada);
      setPaso(2);
      const hojaMsg = creada.nombreHoja ? ` · hoja «${creada.nombreHoja}»` : '';
      toast.success(`Archivo cargado: ${creada.filasTotales} filas${hojaMsg}.`);
      await cargarHistorial();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cargar.');
    } finally {
      setBusy(false);
    }
  }

  async function validar() {
    if (!actual) return;
    setBusy(true);
    setError(null);
    try {
      const v = await apiFetch<Importacion>(`/importaciones/${actual.id}/validar`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setActual(v);
      setPaso(3);
      setConfirmarCheck(false);
      if (v.filasConError > 0) {
        toast.warn(
          `Se encontraron ${v.filasConError} filas con error. Puede confirmar solo las ${v.filasValidas} válidas.`,
        );
      } else {
        toast.success(`Validación OK: ${v.filasValidas} filas válidas.`);
      }
      await cargarHistorial();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo validar.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(simular: boolean) {
    if (!actual) return;
    if (!simular && !confirmarCheck) {
      setError('Marque la casilla de confirmación para aplicar.');
      return;
    }
    setBusy(true);
    setError(null);
    const totalEstimado = actual.filasValidas || 1;
    setProgreso({
      procesadas: actual.resumen?.confirmOffset ?? 0,
      total: totalEstimado,
      porcentaje: 0,
      etiqueta: simular ? 'Simulando…' : 'Importando al catálogo…',
    });
    try {
      if (simular) {
        const r = await apiFetch<Importacion>(`/importaciones/${actual.id}/confirmar`, {
          method: 'POST',
          body: JSON.stringify({ simular: true }),
        });
        setActual(r);
        setProgreso({
          procesadas: r.filasValidas,
          total: r.filasValidas,
          porcentaje: 100,
          etiqueta: 'Simulación completa',
        });
        toast.info(
          `Simulación completa: se crearían ${r.resumen?.altas ?? 0} y se actualizarían ${r.resumen?.actualizaciones ?? r.resumen?.filasActualizadas ?? 0}. No se guardó nada.`,
        );
        await cargarHistorial();
        return;
      }

      let actualLocal = actual;
      let terminado = false;
      while (!terminado) {
        const r = await apiFetch<Importacion>(
          `/importaciones/${actualLocal.id}/confirmar`,
          {
            method: 'POST',
            body: JSON.stringify({
              simular: false,
              loteTamano: LOTE_CONFIRMACION_DEFAULT,
            }),
          },
        );
        actualLocal = r;
        setActual(r);
        const p = r.resumen?.progreso;
        const procesadas = p?.procesadas ?? r.resumen?.confirmOffset ?? 0;
        const total = p?.total ?? r.filasValidas;
        setProgreso({
          procesadas,
          total,
          porcentaje: p?.porcentaje ?? Math.round((procesadas * 100) / Math.max(total, 1)),
          etiqueta: `Importando… ${procesadas} de ${total}`,
        });
        terminado = Boolean(p?.terminado) || r.estado === 'CONFIRMADA';
      }

      toast.success(
        `Importación aplicada: ${actualLocal.resumen?.altas ?? 0} altas, ${actualLocal.resumen?.actualizaciones ?? actualLocal.resumen?.filasActualizadas ?? 0} actualizaciones, ${actualLocal.resumen?.omitidas ?? actualLocal.resumen?.filasOmitidas ?? 0} omitidas.`,
      );
      await cargarHistorial();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo confirmar.');
    } finally {
      setBusy(false);
      setProgreso(null);
    }
  }

  async function cancelar() {
    if (!actual) return;
    setBusy(true);
    try {
      const r = await apiFetch<Importacion>(`/importaciones/${actual.id}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setActual(r);
      toast.success('Importación cancelada.');
      await cargarHistorial();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo cancelar.');
    } finally {
      setBusy(false);
    }
  }

  function reiniciar() {
    setPaso(1);
    setActual(null);
    setArchivo(null);
    setHojas([]);
    setNombreHoja('');
    setCabeceras([]);
    setMapeo({});
    setConfirmarCheck(false);
    setError(null);
    setProgreso(null);
  }

  const importacionParcial =
    actual?.estado === 'VALIDADA' && (actual.resumen?.confirmOffset ?? 0) > 0;

  if (!auth && !error) {
    return (
      <AppShell nav="organizacion">
        <p className="text-sm text-muted">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <BackLink href="/catalogo">Volver al catálogo</BackLink>
      <PageHeader
        title="Importar catálogo"
        description="Cargar → validar → confirmar (o simular)."
      />
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {progreso ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-borde bg-white p-6 shadow-lg">
            <p className="text-sm font-bold text-ink">{progreso.etiqueta}</p>
            <p className="mt-1 text-xs text-muted">
              {progreso.procesadas} / {progreso.total} filas · {progreso.porcentaje}%
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-teal transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progreso.porcentaje))}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              No cierre esta ventana hasta que termine.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex gap-2 text-xs font-bold uppercase tracking-wide">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`rounded-lg px-2 py-1 ${
              paso === n ? 'bg-teal/15 text-teal-deep' : 'bg-paper text-muted'
            }`}
          >
            {n}. {n === 1 ? 'Cargar' : n === 2 ? 'Validar' : 'Confirmar'}
          </span>
        ))}
      </div>

      {paso === 1 ? (
        <form onSubmit={(e) => void cargar(e)} className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Tipo</span>
                <Select
                  value={tipo}
                  onChange={(e) => {
                    setTipo(e.target.value as Tipo);
                    setMapeo({});
                    setCabeceras([]);
                    setHojas([]);
                    setNombreHoja('');
                    setArchivo(null);
                  }}
                >
                  <option value="ITEMS">Items</option>
                  <option value="PRECIOS">Precios</option>
                  <option value="ALIAS">Alias</option>
                </Select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void descargarPlantilla()}>
                  Descargar plantilla Excel
                </Button>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Archivo (.csv o .xlsx, máx. 5 MB)
                </span>
                <Input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => void onArchivo(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
              </label>
              {hojas.length > 1 ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    Hoja a importar
                  </span>
                  <Select
                    value={nombreHoja}
                    onChange={(e) => onCambiarHoja(e.target.value)}
                    required
                  >
                    {hojas.map((h) => (
                      <option key={h.nombre} value={h.nombre}>
                        {h.nombre}
                        {h.cabeceras.length
                          ? ` (${h.cabeceras.slice(0, 3).join(', ')}${
                              h.cabeceras.length > 3 ? '…' : ''
                            })`
                          : ''}
                      </option>
                    ))}
                  </Select>
                  <span className="mt-1 block text-xs text-muted">
                    Se sugiere «Plantilla». No use Instrucciones ni hojas de referencia.
                  </span>
                </label>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-bold">Mapeo de columnas</h2>
              {campos.map((campo) => (
                <label key={campo} className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    {campo}
                    {OBLIGATORIOS[tipo].includes(campo) ? ' *' : ''}
                  </span>
                  {cabeceras.length > 0 ? (
                    <Select
                      value={mapeo[campo] ?? ''}
                      onChange={(e) =>
                        setMapeo((prev) => ({ ...prev, [campo]: e.target.value }))
                      }
                      required={OBLIGATORIOS[tipo].includes(campo)}
                    >
                      <option value="">— No mapear —</option>
                      {cabeceras.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={mapeo[campo] ?? ''}
                      onChange={(e) =>
                        setMapeo((prev) => ({ ...prev, [campo]: e.target.value }))
                      }
                      placeholder="Nombre de columna en el archivo"
                      required={OBLIGATORIOS[tipo].includes(campo)}
                    />
                  )}
                </label>
              ))}
            </CardBody>
          </Card>

          <Button type="submit" disabled={busy || !archivo}>
            {busy ? 'Cargando…' : 'Cargar archivo'}
          </Button>
        </form>
      ) : null}

      {paso === 2 && actual ? (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm">
              <strong>{actual.nombreArchivo}</strong> · {actual.tipo}
              {actual.nombreHoja ? ` · hoja «${actual.nombreHoja}»` : ''} ·{' '}
              {actual.filasTotales} filas · estado {actual.estado}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void validar()}>
                {busy ? 'Validando…' : 'Validar filas'}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void cancelar()}>
                Cancelar
              </Button>
              <Button type="button" variant="secondary" onClick={reiniciar}>
                Nueva importación
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {paso === 3 && actual ? (
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-2">
              <p className="text-sm">
                Válidas: <strong>{actual.filasValidas}</strong> · Con error:{' '}
                <strong>{actual.filasConError}</strong> · Estado:{' '}
                <Badge tone={actual.estado === 'CONFIRMADA' ? 'success' : 'brand'}>
                  {actual.estado}
                </Badge>
              </p>
              {actual.estado === 'VALIDADA' ? (
                <>
                  {importacionParcial ? (
                    <StatusBanner tone="info">
                      Importación parcial: ya se aplicaron{' '}
                      {actual.resumen?.confirmOffset ?? 0} de {actual.filasValidas}{' '}
                      filas. Puede continuar desde donde quedó.
                    </StatusBanner>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmarCheck}
                      onChange={(e) => setConfirmarCheck(e.target.checked)}
                    />
                    Confirmo aplicar {actual.filasValidas} filas válidas al catálogo
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || importacionParcial}
                      onClick={() => void confirmar(true)}
                    >
                      Simular
                    </Button>
                    <Button
                      type="button"
                      disabled={busy || !confirmarCheck}
                      onClick={() => void confirmar(false)}
                    >
                      {importacionParcial ? 'Continuar importación' : 'Confirmar'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void cancelar()}
                    >
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : (
                <Button type="button" variant="secondary" onClick={reiniciar}>
                  Nueva importación
                </Button>
              )}
            </CardBody>
          </Card>

          {actual.erroresDetalle?.length > 0 ? (
            <Card>
              <CardBody>
                <h2 className="mb-2 text-sm font-bold">Errores por fila</h2>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                  {actual.erroresDetalle.slice(0, 100).map((err, i) => (
                    <li key={`${err.fila}-${err.codigo}-${i}`} className="text-muted">
                      Fila {err.fila}
                      {err.campo ? ` · ${err.campo}` : ''}: {err.codigo} — {err.mensaje}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {historial.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-bold text-ink">Historial reciente</h2>
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-white text-sm">
            {historial.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.nombreArchivo}</p>
                  <p className="text-xs text-muted">
                    {h.tipo} · {new Date(h.createdAt).toLocaleString('es-VE')}
                  </p>
                </div>
                <Badge
                  tone={
                    h.estado === 'CONFIRMADA'
                      ? 'success'
                      : h.estado === 'FALLIDA' || h.estado === 'CANCELADA'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {h.estado}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        <Link href="/catalogo" className="underline">
          Volver al listado de items
        </Link>
      </p>
    </AppShell>
  );
}
