'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PERMISOS, hasPermission, type OrgContext } from '@cotizador/shared';
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
  } | null;
  createdAt: string;
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
  const [auth, setAuth] = useState<PerfilAuth | null>(null);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<Tipo>('ITEMS');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cabeceras, setCabeceras] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [actual, setActual] = useState<Importacion | null>(null);
  const [historial, setHistorial] = useState<Importacion[]>([]);
  const [confirmarCheck, setConfirmarCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function leerCabecerasCsv(file: File) {
    const text = await file.text();
    const primera = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const cols = primera
      .split(',')
      .map((c) => c.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
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
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.csv')) {
      await leerCabecerasCsv(file);
    } else {
      setCabeceras([]);
      setMsg('Archivo Excel: mapeará columnas por nombre tras la carga si coinciden con la plantilla.');
      const auto: Record<string, string> = {};
      for (const campo of CAMPOS_POR_TIPO[tipo]) {
        auto[campo] = campo;
      }
      setMapeo(auto);
    }
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
    a.download = `plantilla-${tipo.toLowerCase()}.csv`;
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
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('tipo', tipo);
      fd.append('mapeoColumnas', JSON.stringify(mapeo));
      fd.append('archivo', archivo);
      const creada = await apiFetch<Importacion>('/importaciones', {
        method: 'POST',
        body: fd,
      });
      setActual(creada);
      setPaso(2);
      setMsg(`Archivo cargado: ${creada.filasTotales} filas.`);
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
    setMsg(null);
    try {
      const v = await apiFetch<Importacion>(`/importaciones/${actual.id}/validar`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setActual(v);
      setPaso(3);
      setConfirmarCheck(false);
      if (v.filasConError > 0) {
        setMsg(
          `Se encontraron ${v.filasConError} filas con error. Puede confirmar solo las ${v.filasValidas} válidas.`,
        );
      } else {
        setMsg(`Validación OK: ${v.filasValidas} filas válidas.`);
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
    setMsg(null);
    try {
      const r = await apiFetch<Importacion>(`/importaciones/${actual.id}/confirmar`, {
        method: 'POST',
        body: JSON.stringify({ simular }),
      });
      setActual(r);
      const res = r.resumen;
      if (simular) {
        setMsg(
          `Simulación completa: se crearían ${res?.altas ?? 0} y se actualizarían ${res?.actualizaciones ?? res?.filasActualizadas ?? 0}. No se guardó nada.`,
        );
      } else {
        setMsg(
          `Importación aplicada: ${res?.altas ?? 0} altas, ${res?.actualizaciones ?? res?.filasActualizadas ?? 0} actualizaciones, ${res?.omitidas ?? res?.filasOmitidas ?? 0} omitidas.`,
        );
      }
      await cargarHistorial();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo confirmar.');
    } finally {
      setBusy(false);
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
      setMsg('Importación cancelada.');
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
    setCabeceras([]);
    setMapeo({});
    setConfirmarCheck(false);
    setError(null);
    setMsg(null);
  }

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
      {msg ? <StatusBanner tone="success">{msg}</StatusBanner> : null}

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
                  Descargar plantilla
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
                />
              </label>
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
              <strong>{actual.nombreArchivo}</strong> · {actual.tipo} ·{' '}
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
                      disabled={busy}
                      onClick={() => void confirmar(true)}
                    >
                      Simular
                    </Button>
                    <Button
                      type="button"
                      disabled={busy || !confirmarCheck}
                      onClick={() => void confirmar(false)}
                    >
                      Confirmar
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
