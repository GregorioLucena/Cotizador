'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileDown,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  MOTIVO_MIN_LENGTH,
  PERMISOS,
  hasPermission,
  type OrgContext,
} from '@cotizador/shared';
import {
  ApiClientError,
  apiFetch,
  clearSession,
  getAccessToken,
} from '@/lib/api';
import {
  calcularBloqueosAprobacion,
  candidatosExpandidosPorDefecto,
  conteoSemaforo,
  etiquetaEstadoCotizacion,
  etiquetaResolucion,
  etiquetaTipoEvento,
  formatearCantidadUi,
  formatearFechaEvento,
  formatearImporteUi,
  formatearPuntajeUi,
  mensajeErrorApi,
  normalizarDetalleRespuesta,
  puedeAnular,
  puedeCopiarWhatsApp,
  puedeMarcarEnviada,
  puedeRegistrarResultado,
  toneEstadoCotizacion,
  totalesClienteCompletos,
  tonoSemaforo,
  type CotizacionDetalle,
  type EventoCotizacion,
  type LineaCotizacion,
  type MensajeWhatsApp,
  type PrecotizacionResultado,
  type ResultadoBusquedaItem,
} from '@/lib/cotizaciones';
import {
  AppShell,
  BackLink,
  PageHeader,
  StatusBanner,
} from '@/components/shell/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';

function SemaforoDot({ estado }: { estado: LineaCotizacion['estadoResolucion'] }) {
  const tone = tonoSemaforo(estado);
  const color =
    tone === 'success'
      ? 'bg-exito'
      : tone === 'warn'
        ? 'bg-ambar'
        : 'bg-peligro';
  return (
    <span
      className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', color)}
      aria-hidden
    />
  );
}

function PromptModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-rise rounded-2xl border border-borde bg-surface p-4 shadow-[0_24px_60px_-28px_rgba(18,32,30,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-paper"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemBuscador({
  onElegir,
  disabled,
}: {
  onElegir: (item: ResultadoBusquedaItem) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusquedaItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          setError(null);
          const data = await apiFetch<ResultadoBusquedaItem[]>(
            `/items/buscar?${new URLSearchParams({
              q: term,
              limit: '12',
              estadoRegistro: 'ACTIVO',
            }).toString()}`,
          );
          setResultados(data);
        } catch (err) {
          setError(mensajeErrorApi(err, 'No se pudo buscar.'));
          setResultados([]);
        } finally {
          setBuscando(false);
        }
      })();
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
        Buscar item
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, SKU o alias…"
          className="pl-10"
          disabled={disabled}
          aria-label="Buscar item en el catálogo"
        />
      </div>
      {error && <p className="text-xs text-peligro">{error}</p>}
      {buscando && <p className="text-xs text-muted">Buscando…</p>}
      {!buscando && q.trim().length >= 2 && resultados.length === 0 && (
        <p className="text-xs text-muted">No hay coincidencias</p>
      )}
      {resultados.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-borde bg-paper/80 p-1.5">
          {resultados.map((item) => (
            <li key={item.itemId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onElegir(item)}
                className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">
                    {item.nombre}
                  </span>
                  <span className="block text-xs text-muted">
                    {[item.sku, item.marca, item.unidadCodigo]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-muted">
                  {formatearPuntajeUi(item.puntaje)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CotizacionDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [contexto, setContexto] = useState<OrgContext | null>(null);
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null);
  const [interpretacion, setInterpretacion] = useState<
    PrecotizacionResultado['interpretacion'] | null
  >(null);
  const [eventos, setEventos] = useState<EventoCotizacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoIa, setAvisoIa] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reprocesando, setReprocesando] = useState(false);
  const [lineaBusyId, setLineaBusyId] = useState<string | null>(null);
  const [candidatosAbiertos, setCandidatosAbiertos] = useState<
    Record<string, boolean>
  >({});
  const [buscarLineaId, setBuscarLineaId] = useState<string | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [cantidadNueva, setCantidadNueva] = useState('1');
  const [cantidadesLocales, setCantidadesLocales] = useState<
    Record<string, string>
  >({});
  const [aliasPendiente, setAliasPendiente] = useState<{
    lineaId: string;
    itemId: string;
    texto: string;
    nombreItem: string;
  } | null>(null);
  const [motivoDialog, setMotivoDialog] = useState<
    null | 'perdida' | 'anular' | 'precio'
  >(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [precioOverride, setPrecioOverride] = useState('');
  const [precioLineaId, setPrecioLineaId] = useState<string | null>(null);
  const [mensajePreview, setMensajePreview] = useState<string | null>(null);

  const puedeEditar =
    !!contexto && hasPermission(contexto, PERMISOS.COTIZACIONES_EDITAR);
  const puedeAprobar =
    !!contexto && hasPermission(contexto, PERMISOS.COTIZACIONES_APROBAR);
  const puedeCrear =
    !!contexto && hasPermission(contexto, PERMISOS.COTIZACIONES_CREAR);
  const puedeDocumento =
    !!contexto &&
    hasPermission(contexto, PERMISOS.COTIZACIONES_GENERAR_DOCUMENTO);
  const puedeResultado =
    !!contexto &&
    hasPermission(contexto, PERMISOS.COTIZACIONES_REGISTRAR_RESULTADO);
  const puedeAnularPerm =
    !!contexto && hasPermission(contexto, PERMISOS.COTIZACIONES_ANULAR);
  const puedeSobrescribir =
    !!contexto &&
    hasPermission(contexto, PERMISOS.COTIZACIONES_SOBRESCRIBIR_PRECIO);
  const puedeAlias =
    !!contexto &&
    hasPermission(contexto, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR);
  const puedeBuscarItems =
    !!contexto && hasPermission(contexto, PERMISOS.CATALOGO_ITEMS_VER);

  const esBorrador = cotizacion?.estado === 'BORRADOR';

  const aplicarDetalle = useCallback((data: PrecotizacionResultado | CotizacionDetalle) => {
    const normalizado = normalizarDetalleRespuesta(data);
    setCotizacion(normalizado.cotizacion);
    if (normalizado.interpretacion !== undefined) {
      setInterpretacion(normalizado.interpretacion);
    }
    const locales: Record<string, string> = {};
    for (const l of normalizado.cotizacion.lineas) {
      locales[l.id] = formatearCantidadUi(l.cantidad);
    }
    setCantidadesLocales(locales);
    setCandidatosAbiertos((prev) => {
      const next = { ...prev };
      for (const l of normalizado.cotizacion.lineas) {
        if (next[l.id] === undefined) {
          next[l.id] = candidatosExpandidosPorDefecto(l.estadoResolucion);
        }
      }
      return next;
    });
  }, []);

  const cargarEventos = useCallback(async (cotizacionId: string) => {
    try {
      const data = await apiFetch<EventoCotizacion[]>(
        `/cotizaciones/${cotizacionId}/eventos`,
      );
      setEventos(data);
    } catch {
      /* bitácora no bloquea la pantalla */
    }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado>(`/cotizaciones/${id}`);
      aplicarDetalle(data);
      if (!data.interpretacion?.exito && data.cotizacion.lineas.length === 0) {
        setAvisoIa(
          (prev) =>
            prev ??
            'No se pudo interpretar el mensaje. Puedes armar la cotización a mano.',
        );
      }
      await cargarEventos(id);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return;
      }
      setError(mensajeErrorApi(err, 'No se pudo cargar la cotización.'));
    } finally {
      setLoading(false);
    }
  }, [aplicarDetalle, cargarEventos, id, router]);

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
        if (!hasPermission(perfil.contexto, PERMISOS.COTIZACIONES_VER)) {
          setError('No tiene permiso para ver cotizaciones.');
          setLoading(false);
          return;
        }
        setContexto(perfil.contexto);
        await cargar();
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          clearSession();
          router.replace('/acceso');
          return;
        }
        setError(mensajeErrorApi(err, 'No se pudo cargar.'));
        setLoading(false);
      }
    })();
  }, [cargar, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = sessionStorage.getItem(`cot_aviso_ia_${id}`);
    if (flag) {
      setAvisoIa(flag);
      sessionStorage.removeItem(`cot_aviso_ia_${id}`);
    }
  }, [id]);

  async function mutar(
    path: string,
    init: RequestInit,
    opts?: { lineaId?: string; silent?: boolean },
  ): Promise<PrecotizacionResultado | null> {
    if (opts?.lineaId) setLineaBusyId(opts.lineaId);
    else setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado | CotizacionDetalle>(
        path,
        init,
      );
      const normalizado = normalizarDetalleRespuesta(data);
      aplicarDetalle(normalizado);
      if (normalizado.advertencias?.includes('ALIAS_YA_EXISTE')) {
        setAviso('Ese alias ya existía en el item; la línea se actualizó igual.');
      }
      await cargarEventos(id);
      return normalizado;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearSession();
        router.replace('/acceso');
        return null;
      }
      if (!opts?.silent) {
        setError(mensajeErrorApi(err, 'No se pudo guardar el cambio.'));
      }
      throw err;
    } finally {
      setLineaBusyId(null);
      setBusy(false);
    }
  }

  async function elegirCandidato(lineaId: string, candidatoItemId: string) {
    await mutar(
      `/cotizaciones/${id}/lineas/${lineaId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ candidatoItemId }),
      },
      { lineaId },
    );
  }

  async function asignarItem(
    lineaId: string,
    itemId: string,
    opts?: { guardarAlias?: boolean; textoSolicitado?: string; nombreItem?: string },
  ) {
    const linea = cotizacion?.lineas.find((l) => l.id === lineaId);
    const texto = opts?.textoSolicitado ?? linea?.textoSolicitado?.trim() ?? '';
    const itemCambio = linea?.itemId !== itemId;

    if (
      itemCambio &&
      texto &&
      puedeAlias &&
      opts?.guardarAlias === undefined
    ) {
      setAliasPendiente({
        lineaId,
        itemId,
        texto,
        nombreItem: opts?.nombreItem ?? 'este item',
      });
      return;
    }

    await mutar(
      `/cotizaciones/${id}/lineas/${lineaId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          itemId,
          ...(opts?.guardarAlias === true ? { guardarAlias: true } : {}),
        }),
      },
      { lineaId },
    );
    setBuscarLineaId(null);
    setAliasPendiente(null);
  }

  async function confirmarAlias(guardar: boolean) {
    if (!aliasPendiente) return;
    const { lineaId, itemId } = aliasPendiente;
    setAliasPendiente(null);
    await asignarItem(lineaId, itemId, {
      guardarAlias: guardar ? true : false,
    });
  }

  async function guardarCantidad(linea: LineaCotizacion) {
    const raw = cantidadesLocales[linea.id]?.trim() ?? '';
    if (!raw || raw === formatearCantidadUi(linea.cantidad)) return;
    const normalizada = Number(raw);
    if (!Number.isFinite(normalizada) || normalizada <= 0) {
      setError('La cantidad debe ser mayor que cero.');
      setCantidadesLocales((prev) => ({
        ...prev,
        [linea.id]: formatearCantidadUi(linea.cantidad),
      }));
      return;
    }
    const cantidad = Number.isInteger(normalizada)
      ? String(normalizada)
      : normalizada.toFixed(4).replace(/\.?0+$/, '');
    try {
      await mutar(
        `/cotizaciones/${id}/lineas/${linea.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ cantidad }),
        },
        { lineaId: linea.id },
      );
    } catch {
      setCantidadesLocales((prev) => ({
        ...prev,
        [linea.id]: formatearCantidadUi(linea.cantidad),
      }));
    }
  }

  async function quitarLinea(lineaId: string) {
    const ok = window.confirm('¿Quitar esta línea del borrador?');
    if (!ok) return;
    await mutar(`/cotizaciones/${id}/lineas/${lineaId}`, { method: 'DELETE' }, {
      lineaId,
    });
  }

  async function agregarLinea(item: ResultadoBusquedaItem) {
    const cant = cantidadNueva.trim() || '1';
    await mutar(`/cotizaciones/${id}/lineas`, {
      method: 'POST',
      body: JSON.stringify({
        itemId: item.itemId,
        cantidad: cant,
        textoSolicitado: item.nombre,
      }),
    });
    setAgregarAbierto(false);
    setCantidadNueva('1');
    setAvisoIa(null);
  }

  async function aprobar() {
    if (!cotizacion) return;
    const vigenciaHint =
      'Al aprobar se congelan precios, descuentos y tasa. No se podrán editar las líneas.';
    const ok = window.confirm(vigenciaHint);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado>(
        `/cotizaciones/${id}/aprobar`,
        {
          method: 'POST',
          body: JSON.stringify({
            totalesCliente: totalesClienteCompletos(cotizacion),
          }),
        },
      );
      aplicarDetalle(data);
      await cargarEventos(id);
      setAviso('Cotización aprobada. Los precios quedaron congelados.');
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo aprobar.'));
    } finally {
      setBusy(false);
    }
  }

  async function copiarWhatsApp() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<MensajeWhatsApp>(`/cotizaciones/${id}/mensaje`);
      setMensajePreview(data.texto);
      await navigator.clipboard.writeText(data.texto);
      setAviso('Texto copiado. Pégalo en WhatsApp. Esto no marca la cotización como enviada.');
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo generar el texto.'));
    } finally {
      setBusy(false);
    }
  }

  async function generarPdf() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/cotizaciones/${id}/documento`, { method: 'POST' });
      const detalle = await apiFetch<PrecotizacionResultado | CotizacionDetalle>(
        `/cotizaciones/${id}`,
      );
      aplicarDetalle(detalle);
      setAviso('PDF generado. Ya puede descargarlo.');
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo generar el PDF.'));
    } finally {
      setBusy(false);
    }
  }

  async function descargarPdf() {
    if (!cotizacion) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await apiFetch<Blob>(`/cotizaciones/${id}/documento`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cotizacion.folio}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setAviso('Descarga iniciada.');
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo descargar el PDF.'));
    } finally {
      setBusy(false);
    }
  }

  async function marcarEnviada() {
    const ok = window.confirm(
      '¿Marcar como enviada? Confirma que ya entregaste el mensaje al cliente.',
    );
    if (!ok) return;
    await mutar(`/cotizaciones/${id}/enviada`, { method: 'POST' });
    setAviso('Marcada como enviada.');
  }

  async function registrarGanada() {
    const ok = window.confirm('¿Marcar esta cotización como ganada?');
    if (!ok) return;
    await mutar(`/cotizaciones/${id}/resultado`, {
      method: 'POST',
      body: JSON.stringify({ resultado: 'GANADA' }),
    });
    setAviso('Cotización marcada como ganada.');
  }

  async function confirmarMotivo() {
    if (!motivoDialog) return;
    const motivo = motivoTexto.trim();
    if (motivo.length < MOTIVO_MIN_LENGTH) {
      setError(`El motivo debe tener al menos ${MOTIVO_MIN_LENGTH} caracteres.`);
      return;
    }
    try {
      if (motivoDialog === 'perdida') {
        await mutar(`/cotizaciones/${id}/resultado`, {
          method: 'POST',
          body: JSON.stringify({ resultado: 'PERDIDA', motivoPerdida: motivo }),
        });
        setAviso('Cotización marcada como perdida.');
      } else if (motivoDialog === 'anular') {
        await mutar(`/cotizaciones/${id}/anular`, {
          method: 'POST',
          body: JSON.stringify({ motivoAnulacion: motivo }),
        });
        setAviso('Cotización anulada. El registro se conserva.');
      } else if (motivoDialog === 'precio' && precioLineaId) {
        await mutar(
          `/cotizaciones/${id}/lineas/${precioLineaId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              precioUnitario: precioOverride.trim(),
              motivoSobrescritura: motivo,
            }),
          },
          { lineaId: precioLineaId },
        );
        setAviso('Precio sobrescrito.');
      }
      setMotivoDialog(null);
      setMotivoTexto('');
      setPrecioOverride('');
      setPrecioLineaId(null);
    } catch {
      /* error ya seteado en mutar */
    }
  }

  async function duplicar() {
    const ok = window.confirm(
      'Se creará un borrador nuevo con precios actuales (no los congelados). ¿Continuar?',
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado>(
        `/cotizaciones/${id}/duplicar`,
        { method: 'POST' },
      );
      const nuevo = normalizarDetalleRespuesta(data);
      router.push(`/cotizaciones/${nuevo.cotizacion.id}`);
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo duplicar.'));
      setBusy(false);
    }
  }

  async function reprocesar() {
    if (!cotizacion?.solicitudId || !puedeCrear) return;
    const ok = window.confirm(
      'Se creará un borrador nuevo con una interpretación nueva. El borrador actual no se borra. ¿Continuar?',
    );
    if (!ok) return;
    setReprocesando(true);
    setError(null);
    try {
      const data = await apiFetch<PrecotizacionResultado>(
        `/precotizaciones/${cotizacion.solicitudId}/reprocesar`,
        {
          method: 'POST',
          body: JSON.stringify({
            listaPrecioId: cotizacion.listaPrecioId,
            sucursalId: cotizacion.sucursalId,
          }),
        },
      );
      if (data.interpretacion && !data.interpretacion.exito) {
        sessionStorage.setItem(
          `cot_aviso_ia_${data.cotizacion.id}`,
          'No se pudo interpretar el mensaje. Puedes armar la cotización a mano.',
        );
      }
      router.push(`/cotizaciones/${data.cotizacion.id}`);
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo reprocesar.'));
      setReprocesando(false);
    }
  }

  const bloqueos = useMemo(
    () => (cotizacion ? calcularBloqueosAprobacion(cotizacion) : []),
    [cotizacion],
  );
  const semaforo = useMemo(
    () => (cotizacion ? conteoSemaforo(cotizacion.lineas) : null),
    [cotizacion],
  );

  if (loading) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <p className="py-20 text-center text-sm text-muted">
          Cargando cotización…
        </p>
      </AppShell>
    );
  }

  if (error && !cotizacion) {
    return (
      <AppShell nav="organizacion" maxWidth="lg">
        <BackLink href="/cotizar">← Cotizar</BackLink>
        <div className="mt-4">
          <StatusBanner tone="error">{error}</StatusBanner>
        </div>
      </AppShell>
    );
  }

  if (!cotizacion) return null;

  const clienteLabel =
    cotizacion.nombreClienteLibre ??
    (cotizacion.clienteId ? 'Cliente registrado' : 'Sin cliente');
  const aprobacionBloqueada = bloqueos.length > 0 || !puedeAprobar;

  return (
    <AppShell nav="organizacion" maxWidth="lg">
      <div className={cn(esBorrador && puedeEditar ? 'pb-36' : 'pb-8')}>
        <PageHeader
          eyebrow={<BackLink href="/cotizar">← Cotizar</BackLink>}
          title={cotizacion.folio}
          description={`${clienteLabel} · ${etiquetaEstadoCotizacion(cotizacion.estado)}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Badge tone={toneEstadoCotizacion(cotizacion.estado)}>
                {etiquetaEstadoCotizacion(cotizacion.estado)}
              </Badge>
              {puedeCrear && cotizacion.solicitudId && esBorrador ? (
                <Button
                  variant="secondary"
                  onClick={() => void reprocesar()}
                  disabled={reprocesando || busy}
                  className="shrink-0"
                >
                  <RefreshCw
                    className={cn('size-4', reprocesando && 'animate-spin')}
                    aria-hidden
                  />
                  Reprocesar
                </Button>
              ) : null}
            </div>
          }
        />

        {error && (
          <div className="mb-4">
            <StatusBanner tone="error">{error}</StatusBanner>
          </div>
        )}
        {aviso && (
          <div className="mb-4">
            <StatusBanner tone="success">{aviso}</StatusBanner>
          </div>
        )}
        {(avisoIa || (esBorrador && cotizacion.lineas.length === 0)) && (
          <div className="mb-4">
            <StatusBanner tone="warn">
              {avisoIa ??
                'No se pudo interpretar el mensaje. Arma la cotización a mano.'}{' '}
              {puedeEditar && (
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => setAgregarAbierto(true)}
                >
                  Agregar línea
                </button>
              )}
            </StatusBanner>
          </div>
        )}

        {/* Resumen semáforo + totales */}
        <section className="animate-rise mb-5 space-y-3">
          {semaforo && (
            <p className="text-sm text-slate">
              <span className="font-semibold text-exito">{semaforo.verdes}</span>{' '}
              resueltas
              <span className="text-muted"> · </span>
              <span className="font-semibold text-ambar">{semaforo.ambar}</span>{' '}
              revisar
              <span className="text-muted"> · </span>
              <span className="font-semibold text-peligro">{semaforo.rojas}</span>{' '}
              sin match
            </p>
          )}
          <div className="overflow-hidden rounded-2xl bg-teal text-white">
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
                  {esBorrador ? 'Total borrador' : 'Total congelado'}
                </p>
                <p className="font-display text-3xl font-bold tracking-tight tabular-nums">
                  {formatearImporteUi(cotizacion.total)}
                </p>
              </div>
              <div className="text-right text-sm text-white/80">
                <p>Subtotal {formatearImporteUi(cotizacion.subtotal)}</p>
                {Number(cotizacion.descuentoTotal) > 0 && (
                  <p>Desc. {formatearImporteUi(cotizacion.descuentoTotal)}</p>
                )}
                {Number(cotizacion.impuestoTotal) > 0 && (
                  <p>Imp. {formatearImporteUi(cotizacion.impuestoTotal)}</p>
                )}
                {cotizacion.totalPresentacion && (
                  <p className="mt-0.5">
                    Presentación {formatearImporteUi(cotizacion.totalPresentacion)}
                  </p>
                )}
                {cotizacion.vigenciaHasta && (
                  <p className="mt-1 text-xs text-white/65">
                    Vigencia hasta {formatearFechaEvento(cotizacion.vigenciaHasta)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Líneas */}
        <section className="animate-rise-delay space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Líneas
          </h2>
          {cotizacion.lineas.length === 0 ? (
            <p className="border border-dashed border-borde bg-surface/60 px-4 py-8 text-center text-sm text-muted">
              Sin líneas. {puedeEditar ? 'Agrega un item del catálogo.' : ''}
            </p>
          ) : (
            cotizacion.lineas.map((linea) => {
              const meta = etiquetaResolucion(linea.estadoResolucion);
              const abiertos =
                candidatosAbiertos[linea.id] ??
                candidatosExpandidosPorDefecto(linea.estadoResolucion);
              const lineaBusy = lineaBusyId === linea.id;
              return (
                <article
                  key={linea.id}
                  className={cn(
                    'border-b border-borde/80 py-3.5 first:pt-0',
                    lineaBusy && 'opacity-70',
                  )}
                >
                  <div className="flex gap-3">
                    <SemaforoDot estado={linea.estadoResolucion} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">
                          {linea.descripcion ?? linea.textoSolicitado}
                        </p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {linea.precioSobrescrito && (
                          <Badge tone="warn">Precio fijo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        Pediste: {linea.textoSolicitado}
                        {linea.sku ? ` · ${linea.sku}` : ''}
                      </p>

                      <div className="flex flex-wrap items-end gap-3">
                        {esBorrador && puedeEditar ? (
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                              Cantidad
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={cantidadesLocales[linea.id] ?? ''}
                              onChange={(e) =>
                                setCantidadesLocales((prev) => ({
                                  ...prev,
                                  [linea.id]: e.target.value,
                                }))
                              }
                              onBlur={() => void guardarCantidad(linea)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-24 tabular-nums"
                              disabled={lineaBusy || busy}
                              aria-label={`Cantidad de ${linea.descripcion ?? linea.textoSolicitado}`}
                            />
                          </label>
                        ) : (
                          <p className="text-sm tabular-nums text-slate">
                            {formatearCantidadUi(linea.cantidad)}
                          </p>
                        )}
                        <p className="pb-2.5 text-sm tabular-nums text-slate">
                          {linea.precioUnitario
                            ? `· ${formatearImporteUi(linea.precioUnitario)}`
                            : '· sin precio'}
                          {linea.total
                            ? ` · tot ${formatearImporteUi(linea.total)}`
                            : ''}
                        </p>
                      </div>

                      {/* Candidatos */}
                      {linea.candidatos.length > 0 && (
                        <div className="rounded-lg bg-paper/90 px-2.5 py-2">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted"
                            onClick={() =>
                              setCandidatosAbiertos((prev) => ({
                                ...prev,
                                [linea.id]: !abiertos,
                              }))
                            }
                          >
                            Candidatos ({linea.candidatos.length})
                            {abiertos ? (
                              <ChevronUp className="size-4" aria-hidden />
                            ) : (
                              <ChevronDown className="size-4" aria-hidden />
                            )}
                          </button>
                          {abiertos && (
                            <ul className="mt-2 space-y-1">
                              {linea.candidatos.map((c) => (
                                <li
                                  key={`${c.itemId}-${c.orden}`}
                                  className="flex items-center justify-between gap-2 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate">
                                    {c.orden}. {c.nombre ?? c.itemId.slice(0, 8)}
                                    <span className="ml-2 tabular-nums text-xs text-muted">
                                      {formatearPuntajeUi(c.puntaje)}
                                    </span>
                                  </span>
                                  {esBorrador && puedeEditar && (
                                    <Button
                                      variant="secondary"
                                      className="min-h-9 shrink-0 px-3 text-xs"
                                      disabled={lineaBusy || busy}
                                      onClick={() =>
                                        void elegirCandidato(linea.id, c.itemId)
                                      }
                                    >
                                      Elegir
                                    </Button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {linea.estadoResolucion === 'NO_ENCONTRADA' &&
                        linea.candidatos.length === 0 && (
                          <p className="text-xs text-peligro">
                            Sin candidatos; busca un item.{' '}
                            <Link
                              href="/catalogo/terminos"
                              className="font-semibold underline"
                            >
                              Ver términos
                            </Link>
                          </p>
                        )}

                      {esBorrador && puedeEditar && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {puedeBuscarItems && (
                            <Button
                              variant="ghost"
                              className="min-h-9 px-3 text-xs"
                              disabled={lineaBusy || busy}
                              onClick={() =>
                                setBuscarLineaId((prev) =>
                                  prev === linea.id ? null : linea.id,
                                )
                              }
                            >
                              <Search className="size-3.5" aria-hidden />
                              Buscar item
                            </Button>
                          )}
                          {puedeSobrescribir && linea.itemId && (
                            <Button
                              variant="ghost"
                              className="min-h-9 px-3 text-xs"
                              disabled={lineaBusy || busy}
                              onClick={() => {
                                setPrecioLineaId(linea.id);
                                setPrecioOverride(
                                  linea.precioUnitario
                                    ? formatearCantidadUi(linea.precioUnitario)
                                    : '',
                                );
                                setMotivoTexto('');
                                setMotivoDialog('precio');
                              }}
                            >
                              Sobrescribir precio
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            className="min-h-9 px-3 text-xs text-peligro hover:bg-peligro/8"
                            disabled={lineaBusy || busy}
                            onClick={() => void quitarLinea(linea.id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Quitar
                          </Button>
                        </div>
                      )}

                      {buscarLineaId === linea.id && puedeBuscarItems && (
                        <div className="mt-2 border-t border-borde/60 pt-3">
                          <ItemBuscador
                            disabled={lineaBusy || busy}
                            onElegir={(item) =>
                              void asignarItem(linea.id, item.itemId, {
                                nombreItem: item.nombre,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Agregar línea */}
        {esBorrador && puedeEditar && puedeBuscarItems && (
          <section className="mt-5 space-y-3">
            {!agregarAbierto ? (
              <Button
                variant="secondary"
                onClick={() => setAgregarAbierto(true)}
                disabled={busy}
              >
                <Plus className="size-4" aria-hidden />
                Agregar línea
              </Button>
            ) : (
              <div className="space-y-3 border-t border-borde pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-ink">
                    Nueva línea
                  </h3>
                  <button
                    type="button"
                    className="text-sm font-semibold text-muted hover:text-ink"
                    onClick={() => setAgregarAbierto(false)}
                  >
                    Cerrar
                  </button>
                </div>
                <label className="block max-w-[8rem]">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Cantidad
                  </span>
                  <Input
                    value={cantidadNueva}
                    onChange={(e) => setCantidadNueva(e.target.value)}
                    inputMode="decimal"
                    aria-label="Cantidad de la nueva línea"
                  />
                </label>
                <ItemBuscador
                  disabled={busy}
                  onElegir={(item) => void agregarLinea(item)}
                />
              </div>
            )}
          </section>
        )}

        {/* Acciones post-aprobación */}
        {!esBorrador && (
          <section className="animate-rise-late mt-6 space-y-3 border-t border-borde pt-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Entrega y cierre
            </h2>
            <div className="flex flex-wrap gap-2">
              {puedeDocumento && puedeCopiarWhatsApp(cotizacion.estado) && (
                <Button
                  onClick={() => void copiarWhatsApp()}
                  disabled={busy}
                >
                  <Copy className="size-4" aria-hidden />
                  Copiar para WhatsApp
                </Button>
              )}
              {puedeDocumento &&
                puedeCopiarWhatsApp(cotizacion.estado) &&
                !cotizacion.documentoGenerado && (
                  <Button
                    variant="secondary"
                    onClick={() => void generarPdf()}
                    disabled={busy}
                  >
                    <FileDown className="size-4" aria-hidden />
                    Generar PDF
                  </Button>
                )}
              {cotizacion.documentoGenerado &&
                hasPermission(
                  contexto!,
                  PERMISOS.COTIZACIONES_VER,
                ) && (
                  <Button
                    variant="secondary"
                    onClick={() => void descargarPdf()}
                    disabled={busy}
                  >
                    <Download className="size-4" aria-hidden />
                    Descargar PDF
                  </Button>
                )}
              {puedeResultado && puedeMarcarEnviada(cotizacion.estado) && (
                <Button
                  variant="secondary"
                  onClick={() => void marcarEnviada()}
                  disabled={busy}
                >
                  Marcar como enviada
                </Button>
              )}
              {puedeResultado && puedeRegistrarResultado(cotizacion.estado) && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => void registrarGanada()}
                    disabled={busy}
                  >
                    <Check className="size-4" aria-hidden />
                    Ganada
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMotivoTexto('');
                      setMotivoDialog('perdida');
                    }}
                    disabled={busy}
                  >
                    Perdida
                  </Button>
                </>
              )}
              {puedeCrear && (
                <Button
                  variant="secondary"
                  onClick={() => void duplicar()}
                  disabled={busy}
                >
                  Duplicar
                </Button>
              )}
              {puedeAnularPerm && puedeAnular(cotizacion.estado) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setMotivoTexto('');
                    setMotivoDialog('anular');
                  }}
                  disabled={busy}
                >
                  Anular
                </Button>
              )}
            </div>
            {mensajePreview && (
              <details className="rounded-xl border border-borde bg-surface px-3 py-2.5">
                <summary className="cursor-pointer text-sm font-semibold text-slate">
                  Vista previa del mensaje
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate">
                  {mensajePreview}
                </pre>
              </details>
            )}
            {cotizacion.motivoPerdida && (
              <p className="text-sm text-muted">
                Motivo de pérdida: {cotizacion.motivoPerdida}
              </p>
            )}
            {cotizacion.motivoAnulacion && (
              <p className="text-sm text-muted">
                Motivo de anulación: {cotizacion.motivoAnulacion}
              </p>
            )}
          </section>
        )}

        {/* Duplicar / anular también en borrador */}
        {esBorrador && (puedeCrear || puedeAnularPerm) && (
          <section className="mt-6 flex flex-wrap gap-2">
            {puedeCrear && (
              <Button
                variant="ghost"
                onClick={() => void duplicar()}
                disabled={busy}
              >
                Duplicar
              </Button>
            )}
            {puedeAnularPerm && (
              <Button
                variant="ghost"
                className="text-peligro"
                onClick={() => {
                  setMotivoTexto('');
                  setMotivoDialog('anular');
                }}
                disabled={busy}
              >
                Anular
              </Button>
            )}
          </section>
        )}

        {interpretacion && (
          <details className="mt-6 rounded-xl border border-borde bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate">
              Traza de interpretación
            </summary>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted">Proveedor</dt>
                <dd className="font-semibold text-ink">{interpretacion.proveedor}</dd>
              </div>
              <div>
                <dt className="text-muted">Modelo</dt>
                <dd className="font-semibold text-ink">{interpretacion.modelo}</dd>
              </div>
              <div>
                <dt className="text-muted">Prompt</dt>
                <dd className="font-semibold text-ink">
                  {interpretacion.versionPrompt}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Latencia</dt>
                <dd className="font-semibold text-ink">
                  {interpretacion.latenciaMs} ms
                </dd>
              </div>
            </dl>
          </details>
        )}

        {/* Bitácora */}
        <section className="mt-8 space-y-3 border-t border-borde pt-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Bitácora
          </h2>
          {eventos.length === 0 ? (
            <p className="text-sm text-muted">Sin eventos registrados aún.</p>
          ) : (
            <ol className="space-y-2.5">
              {eventos.map((ev) => (
                <li key={ev.id} className="text-sm">
                  <p className="font-semibold text-ink">
                    {etiquetaTipoEvento(ev.tipo)}
                    <span className="ml-2 font-normal text-xs text-muted">
                      {formatearFechaEvento(ev.createdAt)}
                    </span>
                  </p>
                  {ev.descripcion && (
                    <p className="text-slate">{ev.descripcion}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Rail sticky — firma visual de revisión */}
      {esBorrador && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-borde bg-paper/95 px-4 py-3 shadow-[0_-12px_32px_-16px_rgba(18,32,30,0.28)] backdrop-blur-md supports-[backdrop-filter]:bg-paper/85 sm:-mx-6 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-2.5">
            {bloqueos.length > 0 ? (
              <ul className="space-y-0.5 text-xs text-[#8a5a00]" aria-live="polite">
                {bloqueos.map((b) => (
                  <li key={b.codigo}>· {b.mensaje}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-exito">Lista para aprobar</p>
            )}
            {!puedeAprobar && (
              <p className="text-xs text-muted">
                No tienes permiso para aprobar cotizaciones.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {puedeEditar && puedeBuscarItems && (
                <Button
                  variant="secondary"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    setAgregarAbierto(true);
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }}
                  disabled={busy}
                >
                  <Plus className="size-4" aria-hidden />
                  Agregar
                </Button>
              )}
              <Button
                className="min-w-[12rem] flex-1 sm:flex-none"
                disabled={aprobacionBloqueada || busy}
                onClick={() => void aprobar()}
                title={
                  bloqueos.length > 0
                    ? 'Resuelve los bloqueos antes de aprobar'
                    : undefined
                }
              >
                Aprobar cotización
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo alias */}
      {aliasPendiente && (
        <PromptModal
          title="¿Guardar como alias?"
          onClose={() => setAliasPendiente(null)}
        >
          <p className="mb-4 text-sm text-slate">
            Guardar «{aliasPendiente.texto}» como alias de{' '}
            <span className="font-semibold text-ink">
              {aliasPendiente.nombreItem}
            </span>
            . Por defecto no se guarda.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant="secondary"
              onClick={() => void confirmarAlias(false)}
              disabled={busy}
            >
              Solo asignar item
            </Button>
            <Button onClick={() => void confirmarAlias(true)} disabled={busy}>
              Guardar alias
            </Button>
          </div>
        </PromptModal>
      )}

      {/* Diálogos de motivo */}
      {motivoDialog && (
        <PromptModal
          title={
            motivoDialog === 'perdida'
              ? 'Marcar como perdida'
              : motivoDialog === 'anular'
                ? 'Anular cotización'
                : 'Sobrescribir precio'
          }
          onClose={() => {
            setMotivoDialog(null);
            setMotivoTexto('');
            setPrecioOverride('');
            setPrecioLineaId(null);
          }}
        >
          {motivoDialog === 'anular' && (
            <p className="mb-3 text-sm text-slate">
              El registro se conserva. No se puede deshacer la anulación.
            </p>
          )}
          {motivoDialog === 'precio' && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Precio unitario
              </span>
              <Input
                value={precioOverride}
                onChange={(e) => setPrecioOverride(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Precio unitario sobrescrito"
              />
            </label>
          )}
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Motivo (mín. {MOTIVO_MIN_LENGTH} caracteres)
            </span>
            <Textarea
              value={motivoTexto}
              onChange={(e) => setMotivoTexto(e.target.value)}
              rows={3}
              aria-label="Motivo"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant={motivoDialog === 'anular' ? 'danger' : 'primary'}
              onClick={() => void confirmarMotivo()}
              disabled={
                busy ||
                motivoTexto.trim().length < MOTIVO_MIN_LENGTH ||
                (motivoDialog === 'precio' && !precioOverride.trim())
              }
            >
              Confirmar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMotivoDialog(null);
                setMotivoTexto('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </PromptModal>
      )}
    </AppShell>
  );
}
