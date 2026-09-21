'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  POLITICA_EXTRACCION_DEFAULT,
  VERTICAL_PROMPT_FALLBACK,
  type PoliticaExtraccion,
  type ResultadoEvaluacionPrompt,
} from '@cotizador/shared';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type IaConfig = {
  proveedor: string;
  modelo: string;
  temperatura: number;
  apiKeyConfigurada: boolean;
  versionesActivas: Array<{ verticalCodigo: string; codigo: string }>;
  contratoVersion: string;
  verticalFallback: string;
};

type PromptVersion = {
  id: string;
  verticalCodigo: string;
  codigo: string;
  estado: string;
  contratoVersion: string;
  politica: PoliticaExtraccion;
  notasCambio: string | null;
  ultimaEvaluacion: ResultadoEvaluacionPrompt | null;
  publishedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
};

type VerticalItem = { codigo: string; nombre: string };

type PreviewData = {
  mensajes: Array<{ role: string; content: string }>;
  versionPrompt: string;
  contratoVersion: string;
};

function estadoTone(estado: string): string {
  if (estado === 'ACTIVA') return 'text-exito';
  if (estado === 'PUBLICADA') return 'text-ink';
  if (estado === 'BORRADOR') return 'text-muted';
  return 'text-muted';
}

export default function PlataformaIaPage() {
  const router = useRouter();
  const toast = useToast();
  const [config, setConfig] = useState<IaConfig | null>(null);
  const [verticales, setVerticales] = useState<VerticalItem[]>([]);
  const [filtroVertical, setFiltroVertical] = useState<string>('');
  const [verticalNueva, setVerticalNueva] = useState('FERRETERIA');
  const [versiones, setVersiones] = useState<PromptVersion[]>([]);
  const [seleccionada, setSeleccionada] = useState<PromptVersion | null>(null);
  const [politicaDraft, setPoliticaDraft] = useState<PoliticaExtraccion>(
    POLITICA_EXTRACCION_DEFAULT,
  );
  const [codigoNuevo, setCodigoNuevo] = useState(
    'extraccion-lineas.FERRETERIA.v2',
  );
  const [notas, setNotas] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filtroVertical
        ? `?verticalCodigo=${encodeURIComponent(filtroVertical)}`
        : '';
      const [cfg, list, verts] = await Promise.all([
        apiFetch<IaConfig>('/plataforma/ia/config'),
        apiFetch<PromptVersion[]>(`/plataforma/ia/prompts${qs}`),
        apiFetch<VerticalItem[]>('/verticales').catch(() => []),
      ]);
      setConfig(cfg);
      setVersiones(list);
      if (Array.isArray(verts) && verts.length) setVerticales(verts);
      const activa =
        list.find((v) => v.estado === 'ACTIVA') ?? list[0] ?? null;
      if (activa) {
        setSeleccionada(activa);
        setPoliticaDraft(activa.politica);
        setNotas(activa.notasCambio ?? '');
        setVerticalNueva(activa.verticalCodigo);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setError('No tiene permiso para el laboratorio de IA.');
        return;
      }
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo cargar.',
      );
    } finally {
      setLoading(false);
    }
  }, [filtroVertical, router]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/acceso');
      return;
    }
    void cargar();
  }, [cargar, router]);

  useEffect(() => {
    setCodigoNuevo(`extraccion-lineas.${verticalNueva}.v2`);
  }, [verticalNueva]);

  function seleccionar(v: PromptVersion) {
    setSeleccionada(v);
    setPoliticaDraft(v.politica);
    setNotas(v.notasCambio ?? '');
    setVerticalNueva(v.verticalCodigo);
    setPreview(null);
    setError(null);
  }

  async function crearBorrador(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const creada = await apiFetch<PromptVersion>('/plataforma/ia/prompts', {
        method: 'POST',
        body: JSON.stringify({
          verticalCodigo: verticalNueva,
          codigo: codigoNuevo.trim(),
          politica: politicaDraft,
          notasCambio: notas.trim() || undefined,
        }),
      });
      toast.success(`Borrador ${creada.codigo} (${creada.verticalCodigo}) creado.`);
      await cargar();
      seleccionar(creada);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo crear.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function guardarBorrador() {
    if (!seleccionada || seleccionada.estado !== 'BORRADOR') return;
    setBusy(true);
    setError(null);
    try {
      const actualizada = await apiFetch<PromptVersion>(
        `/plataforma/ia/prompts/${seleccionada.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            politica: politicaDraft,
            notasCambio: notas.trim() || undefined,
          }),
        },
      );
      toast.success('Borrador guardado.');
      await cargar();
      seleccionar(actualizada);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo guardar.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function accion(
    path: 'publicar' | 'activar' | 'evaluar',
    label: string,
  ) {
    if (!seleccionada) return;
    setBusy(true);
    setError(null);
    try {
      const actualizada = await apiFetch<PromptVersion>(
        `/plataforma/ia/prompts/${seleccionada.id}/${path}`,
        {
          method: 'POST',
          body:
            path === 'evaluar' ? JSON.stringify({ limiteMuestras: 10 }) : '{}',
        },
      );
      toast.success(`${label} OK (${actualizada.verticalCodigo}).`);
      await cargar();
      seleccionar(actualizada);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : `Falló ${label}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function verPreview() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<PreviewData>(
        '/plataforma/ia/prompts/preview',
        {
          method: 'POST',
          body: JSON.stringify({
            politica: politicaDraft,
            codigo: seleccionada?.codigo ?? codigoNuevo,
            verticalCodigo: seleccionada?.verticalCodigo ?? verticalNueva,
          }),
        },
      );
      setPreview(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'No se pudo generar la vista previa.',
      );
    } finally {
      setBusy(false);
    }
  }

  const opcionesVertical =
    verticales.length > 0
      ? verticales
      : [
          { codigo: 'FERRETERIA', nombre: 'Ferretería' },
          { codigo: 'AUTOMOTRIZ', nombre: 'Automotriz' },
          { codigo: 'REPUESTOS', nombre: 'Repuestos' },
          { codigo: VERTICAL_PROMPT_FALLBACK, nombre: 'Genérico' },
        ];

  return (
    <AppShell nav="plataforma">
      <BackLink href="/panel">← Panel</BackLink>
      <PageHeader
        title="Laboratorio de IA"
        description="Una política ACTIVA por vertical. Al cotizar se usa la de la organización (fallback GENERICO)."
      />

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-8">
          {config ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Meta label="Proveedor" value={config.proveedor} />
              <Meta label="Modelo" value={config.modelo} />
              <Meta
                label="API key"
                value={config.apiKeyConfigurada ? 'Configurada' : 'Ausente'}
              />
              <Meta label="Contrato" value={config.contratoVersion} />
              <Meta label="Fallback" value={config.verticalFallback} />
              <Meta
                label="Activas"
                value={
                  config.versionesActivas.length
                    ? config.versionesActivas
                        .map((a) => `${a.verticalCodigo}:${a.codigo}`)
                        .join(' · ')
                    : '—'
                }
              />
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr]">
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Filtrar vertical
                <select
                  className="min-h-11 rounded-xl border border-borde bg-white px-3 text-sm"
                  value={filtroVertical}
                  onChange={(e) => setFiltroVertical(e.target.value)}
                >
                  <option value="">Todas</option>
                  {opcionesVertical.map((v) => (
                    <option key={v.codigo} value={v.codigo}>
                      {v.nombre} ({v.codigo})
                    </option>
                  ))}
                </select>
              </label>
              <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Versiones
              </h2>
              <ul className="flex flex-col gap-1">
                {versiones.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => seleccionar(v)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        seleccionada?.id === v.id
                          ? 'border-teal/30 bg-teal/8'
                          : 'border-borde hover:bg-white'
                      }`}
                    >
                      <span className="block text-xs text-muted">
                        {v.verticalCodigo}
                      </span>
                      <span className="font-medium text-ink">{v.codigo}</span>
                      <span className={`ml-2 text-xs ${estadoTone(v.estado)}`}>
                        {v.estado}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-5">
              <form
                onSubmit={crearBorrador}
                className="flex flex-wrap items-end gap-3 border-b border-borde pb-4"
              >
                <label className="flex min-w-[10rem] flex-col gap-1 text-sm text-ink">
                  Vertical
                  <select
                    className="min-h-11 rounded-xl border border-borde bg-white px-3 text-sm"
                    value={verticalNueva}
                    onChange={(e) => setVerticalNueva(e.target.value)}
                  >
                    {opcionesVertical.map((v) => (
                      <option key={v.codigo} value={v.codigo}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm text-ink">
                  Nuevo código
                  <Input
                    value={codigoNuevo}
                    onChange={(e) => setCodigoNuevo(e.target.value)}
                    placeholder="extraccion-lineas.FERRETERIA.v2"
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  Crear borrador
                </Button>
              </form>

              {seleccionada ? (
                <p className="text-sm text-muted">
                  Editando{' '}
                  <span className="font-medium text-ink">
                    {seleccionada.codigo}
                  </span>{' '}
                  · vertical {seleccionada.verticalCodigo}
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm text-ink">
                Blacklist (una por línea)
                <textarea
                  className="min-h-[6rem] rounded-xl border border-borde bg-white px-3 py-2 text-sm"
                  value={politicaDraft.blacklist.join('\n')}
                  onChange={(e) =>
                    setPoliticaDraft((p) => ({
                      ...p,
                      blacklist: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  disabled={
                    !!seleccionada && seleccionada.estado !== 'BORRADOR'
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                Reglas de cantidad
                <textarea
                  className="min-h-[4rem] rounded-xl border border-borde bg-white px-3 py-2 text-sm"
                  value={politicaDraft.reglasCantidad}
                  onChange={(e) =>
                    setPoliticaDraft((p) => ({
                      ...p,
                      reglasCantidad: e.target.value,
                    }))
                  }
                  disabled={
                    !!seleccionada && seleccionada.estado !== 'BORRADOR'
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                Instrucciones extra
                <textarea
                  className="min-h-[4rem] rounded-xl border border-borde bg-white px-3 py-2 text-sm"
                  value={politicaDraft.instruccionesExtra}
                  onChange={(e) =>
                    setPoliticaDraft((p) => ({
                      ...p,
                      instruccionesExtra: e.target.value,
                    }))
                  }
                  disabled={
                    !!seleccionada && seleccionada.estado !== 'BORRADOR'
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                Few-shots (JSON)
                <textarea
                  className="min-h-[8rem] rounded-xl border border-borde bg-white px-3 py-2 font-mono text-xs"
                  value={JSON.stringify(politicaDraft.fewShots, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as unknown;
                      if (Array.isArray(parsed)) {
                        setPoliticaDraft((p) => ({
                          ...p,
                          fewShots: parsed as PoliticaExtraccion['fewShots'],
                        }));
                      }
                    } catch {
                      /* mientras escribe */
                    }
                  }}
                  disabled={
                    !!seleccionada && seleccionada.estado !== 'BORRADOR'
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-ink">
                Notas del cambio
                <Input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  disabled={
                    !!seleccionada && seleccionada.estado !== 'BORRADOR'
                  }
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {seleccionada?.estado === 'BORRADOR' ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void guardarBorrador()}
                  >
                    Guardar borrador
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void verPreview()}
                >
                  Vista previa
                </Button>
                {seleccionada?.estado === 'BORRADOR' ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void accion('publicar', 'Publicar')}
                  >
                    Publicar
                  </Button>
                ) : null}
                {seleccionada &&
                (seleccionada.estado === 'PUBLICADA' ||
                  seleccionada.estado === 'ACTIVA') ? (
                  <Button
                    type="button"
                    disabled={busy || seleccionada.estado === 'ACTIVA'}
                    onClick={() => void accion('activar', 'Activar')}
                  >
                    Activar
                  </Button>
                ) : null}
                {seleccionada ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void accion('evaluar', 'Evaluar')}
                  >
                    Evaluar
                  </Button>
                ) : null}
              </div>

              {seleccionada?.ultimaEvaluacion ? (
                <div className="rounded-xl border border-borde bg-white p-3 text-sm">
                  <p className="font-medium text-ink">Última evaluación</p>
                  <p className="text-muted">
                    {seleccionada.ultimaEvaluacion.muestras} muestras ·{' '}
                    {seleccionada.ultimaEvaluacion.jsonValido} JSON válido ·{' '}
                    {seleccionada.ultimaEvaluacion.salidaInvalida} inválidas ·{' '}
                    {seleccionada.ultimaEvaluacion.ceroLineas} cero líneas ·{' '}
                    {seleccionada.ultimaEvaluacion.erroresProveedor} errores
                    proveedor
                    {seleccionada.ultimaEvaluacion.latenciaMsP50 != null
                      ? ` · p50 ${seleccionada.ultimaEvaluacion.latenciaMsP50} ms`
                      : ''}
                  </p>
                </div>
              ) : null}

              {preview ? (
                <div className="rounded-xl border border-borde bg-white p-3">
                  <p className="mb-2 text-sm font-medium text-ink">
                    Prompt compuesto ({preview.contratoVersion} /{' '}
                    {preview.versionPrompt})
                  </p>
                  {preview.mensajes.map((m) => (
                    <div key={m.role} className="mb-3">
                      <p className="text-xs uppercase text-muted">{m.role}</p>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-ink">
                        {m.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-medium text-ink break-words">{value}</p>
    </div>
  );
}
