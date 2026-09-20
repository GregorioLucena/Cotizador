export type EstadoResolucion =
  | 'RESUELTA_AUTOMATICA'
  | 'SUGERIDA_REVISAR'
  | 'NO_ENCONTRADA'
  | 'RESUELTA_MANUAL'
  | 'AGREGADA_MANUAL';

export type EstadoCotizacion =
  | 'BORRADOR'
  | 'APROBADA'
  | 'ENVIADA'
  | 'GANADA'
  | 'PERDIDA'
  | 'ANULADA'
  | 'VENCIDA';

export type CandidatoLinea = {
  itemId: string;
  puntaje: string;
  origenMatch: string;
  orden: number;
  nombre: string | null;
};

export type LineaCotizacion = {
  id: string;
  orden: number;
  textoSolicitado: string;
  itemId: string | null;
  descripcion: string | null;
  sku: string | null;
  unidadMedidaId: string | null;
  cantidad: string;
  precioLista: string | null;
  precioUnitario: string | null;
  descuentoMonto: string;
  descuentoPorcentaje?: string | null;
  precioSobrescrito?: boolean;
  motivoSobrescritura?: string | null;
  subtotal: string | null;
  total: string | null;
  estadoResolucion: EstadoResolucion;
  confianza: string;
  origenMatch: string | null;
  notas: string | null;
  candidatos: CandidatoLinea[];
};

export type CotizacionDetalle = {
  id: string;
  folio: string;
  folioNumero: number;
  estado: EstadoCotizacion | string;
  solicitudId: string | null;
  clienteId: string | null;
  nombreClienteLibre: string | null;
  telefonoClienteLibre: string | null;
  listaPrecioId: string;
  sucursalId: string;
  monedaBaseId: string;
  monedaPresentacionId: string | null;
  tasaAplicada: string | null;
  tasaFecha: string | null;
  vigenciaHasta?: string | null;
  subtotal: string;
  descuentoTotal: string;
  impuestoTotal: string;
  total: string;
  totalPresentacion: string | null;
  porcentajeImpuestoAplicado: string;
  observaciones: string | null;
  textoCondiciones?: string | null;
  textoPie?: string | null;
  aprobadaPorId?: string | null;
  aprobadaAt?: string | null;
  enviadaAt?: string | null;
  resultadoAt?: string | null;
  motivoPerdida?: string | null;
  anulado?: boolean;
  anuladoAt?: string | null;
  motivoAnulacion?: string | null;
  cotizacionOrigenId?: string | null;
  documentoGenerado?: {
    id: string;
    plantillaVersion: number;
    hashContenido: string;
    tamanoBytes: number;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  lineas: LineaCotizacion[];
};

export type InterpretacionResumen = {
  id: string;
  exito: boolean;
  proveedor: string;
  modelo: string;
  versionPrompt: string;
  latenciaMs: number;
  advertencias: string[];
  errorCodigo: string | null;
};

export type ResumenResolucion = {
  lineasTotales: number;
  resueltasAutomaticas: number;
  sugeridas: number;
  noEncontradas: number;
};

export type PrecotizacionResultado = {
  cotizacion: CotizacionDetalle;
  interpretacion: InterpretacionResumen | null;
  resumen: ResumenResolucion;
  advertencias?: string[];
};

export type MensajeWhatsApp = {
  texto: string;
  cotizacionId: string;
  folio: string;
  estado: string;
  generadoAt: string;
};

export type EventoCotizacion = {
  id: string;
  tipo: string;
  descripcion: string | null;
  datos: Record<string, unknown> | null;
  usuarioId: string | null;
  createdAt: string;
};

export type ResultadoBusquedaItem = {
  itemId: string;
  sku: string | null;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  unidadCodigo: string;
  tipoItem?: string;
  puntaje: string;
  origenMatch: string;
  aliasCoincidente: string | null;
  stockAproximado: string | null;
};

export type CodigoBloqueoAprobacion =
  | 'SIN_LINEAS'
  | 'NO_ENCONTRADA'
  | 'SIN_ITEM'
  | 'SIN_PRECIO';

export type BloqueoAprobacion = {
  codigo: CodigoBloqueoAprobacion;
  mensaje: string;
  lineaIds?: string[];
};

/** Semáforo visual: verde / ámbar / rojo según estado de resolución. */
export function tonoSemaforo(
  estado: EstadoResolucion,
): 'success' | 'warn' | 'danger' {
  switch (estado) {
    case 'SUGERIDA_REVISAR':
      return 'warn';
    case 'NO_ENCONTRADA':
      return 'danger';
    default:
      return 'success';
  }
}

export function etiquetaResolucion(estado: EstadoResolucion): {
  label: string;
  tone: 'success' | 'warn' | 'danger' | 'neutral';
} {
  switch (estado) {
    case 'RESUELTA_AUTOMATICA':
    case 'RESUELTA_MANUAL':
      return { label: 'Resuelta', tone: 'success' };
    case 'SUGERIDA_REVISAR':
      return { label: 'Revisar', tone: 'warn' };
    case 'NO_ENCONTRADA':
      return { label: 'Sin match', tone: 'danger' };
    case 'AGREGADA_MANUAL':
      return { label: 'Manual', tone: 'success' };
    default:
      return { label: estado, tone: 'neutral' };
  }
}

export function etiquetaEstadoCotizacion(estado: string): string {
  switch (estado) {
    case 'BORRADOR':
      return 'Borrador';
    case 'APROBADA':
      return 'Aprobada';
    case 'ENVIADA':
      return 'Enviada';
    case 'GANADA':
      return 'Ganada';
    case 'PERDIDA':
      return 'Perdida';
    case 'ANULADA':
      return 'Anulada';
    case 'VENCIDA':
      return 'Vencida';
    default:
      return estado;
  }
}

export function toneEstadoCotizacion(
  estado: string,
): 'neutral' | 'success' | 'warn' | 'danger' | 'brand' {
  switch (estado) {
    case 'BORRADOR':
      return 'neutral';
    case 'APROBADA':
    case 'ENVIADA':
      return 'brand';
    case 'GANADA':
      return 'success';
    case 'PERDIDA':
    case 'ANULADA':
      return 'danger';
    case 'VENCIDA':
      return 'warn';
    default:
      return 'neutral';
  }
}

/** Candidatos expandidos por defecto en ámbar/rojo; plegados en verdes. */
export function candidatosExpandidosPorDefecto(
  estado: EstadoResolucion,
): boolean {
  return estado === 'SUGERIDA_REVISAR' || estado === 'NO_ENCONTRADA';
}

export function esVerde(estado: EstadoResolucion): boolean {
  return tonoSemaforo(estado) === 'success';
}

export function tienePrecioCotizable(linea: LineaCotizacion): boolean {
  return linea.precioUnitario != null && Number(linea.precioUnitario) > 0;
}

/**
 * Bloqueos de aprobación en texto de mostrador (spec 009).
 * No incluye validaciones de cantidad ni de permiso.
 */
export function calcularBloqueosAprobacion(
  cotizacion: CotizacionDetalle,
): BloqueoAprobacion[] {
  const bloqueos: BloqueoAprobacion[] = [];

  if (cotizacion.lineas.length === 0) {
    bloqueos.push({
      codigo: 'SIN_LINEAS',
      mensaje: 'Agrega al menos una línea para poder aprobar.',
    });
    return bloqueos;
  }

  const noEncontradas = cotizacion.lineas.filter(
    (l) => l.estadoResolucion === 'NO_ENCONTRADA',
  );
  if (noEncontradas.length > 0) {
    bloqueos.push({
      codigo: 'NO_ENCONTRADA',
      mensaje:
        noEncontradas.length === 1
          ? 'Hay 1 línea sin coincidencia en el catálogo.'
          : `Hay ${noEncontradas.length} líneas sin coincidencia en el catálogo.`,
      lineaIds: noEncontradas.map((l) => l.id),
    });
  }

  const sinItem = cotizacion.lineas.filter(
    (l) =>
      !l.itemId &&
      l.estadoResolucion !== 'NO_ENCONTRADA',
  );
  if (sinItem.length > 0) {
    bloqueos.push({
      codigo: 'SIN_ITEM',
      mensaje:
        sinItem.length === 1
          ? 'Hay 1 línea sin item asignado.'
          : `Hay ${sinItem.length} líneas sin item asignado.`,
      lineaIds: sinItem.map((l) => l.id),
    });
  }

  const sinPrecio = cotizacion.lineas.filter(
    (l) => l.itemId && !tienePrecioCotizable(l),
  );
  if (sinPrecio.length > 0) {
    bloqueos.push({
      codigo: 'SIN_PRECIO',
      mensaje:
        sinPrecio.length === 1
          ? 'Hay 1 línea sin precio cotizable.'
          : `Hay ${sinPrecio.length} líneas sin precio cotizable.`,
      lineaIds: sinPrecio.map((l) => l.id),
    });
  }

  return bloqueos;
}

export function conteoSemaforo(lineas: LineaCotizacion[]): {
  verdes: number;
  ambar: number;
  rojas: number;
} {
  let verdes = 0;
  let ambar = 0;
  let rojas = 0;
  for (const l of lineas) {
    const t = tonoSemaforo(l.estadoResolucion);
    if (t === 'success') verdes += 1;
    else if (t === 'warn') ambar += 1;
    else rojas += 1;
  }
  return { verdes, ambar, rojas };
}

export function formatearCantidadUi(cantidad: string): string {
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return cantidad;
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

export function formatearImporteUi(valor: string | null | undefined): string {
  if (valor == null || valor === '') return '—';
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  return n.toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatearPuntajeUi(puntaje: string): string {
  const n = Number(puntaje);
  if (!Number.isFinite(n)) return puntaje;
  if (n <= 1) return `${Math.round(n * 100)}%`;
  return n.toFixed(2);
}

export function formatearFechaEvento(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function etiquetaTipoEvento(tipo: string): string {
  const map: Record<string, string> = {
    CREADA: 'Creada',
    INTERPRETADA: 'Interpretada',
    LINEA_CORREGIDA: 'Línea corregida',
    LINEA_AGREGADA: 'Línea agregada',
    LINEA_ELIMINADA: 'Línea eliminada',
    PRECIO_SOBRESCRITO: 'Precio sobrescrito',
    ALIAS_APRENDIDO: 'Alias aprendido',
    RECALCULADA: 'Recalculada',
    APROBADA: 'Aprobada',
    ENVIADA: 'Enviada',
    MARCADA_GANADA: 'Marcada ganada',
    MARCADA_PERDIDA: 'Marcada perdida',
    ANULADA: 'Anulada',
    DUPLICADA: 'Duplicada',
    DOCUMENTO_GENERADO: 'Documento generado',
    VENCIDA: 'Vencida',
  };
  return map[tipo] ?? tipo;
}

/** Extrae el detalle de cotización desde la respuesta de mutación o GET. */
export function normalizarDetalleRespuesta(
  data: PrecotizacionResultado | CotizacionDetalle,
): PrecotizacionResultado {
  if ('cotizacion' in data && data.cotizacion) {
    return data;
  }
  const cotizacion = data as CotizacionDetalle;
  return {
    cotizacion,
    interpretacion: null,
    resumen: {
      lineasTotales: cotizacion.lineas.length,
      resueltasAutomaticas: cotizacion.lineas.filter(
        (l) => l.estadoResolucion === 'RESUELTA_AUTOMATICA',
      ).length,
      sugeridas: cotizacion.lineas.filter(
        (l) => l.estadoResolucion === 'SUGERIDA_REVISAR',
      ).length,
      noEncontradas: cotizacion.lineas.filter(
        (l) => l.estadoResolucion === 'NO_ENCONTRADA',
      ).length,
    },
  };
}

export function totalesClienteCompletos(cotizacion: CotizacionDetalle) {
  return {
    subtotal: cotizacion.subtotal,
    descuentoTotal: cotizacion.descuentoTotal,
    impuestoTotal: cotizacion.impuestoTotal,
    total: cotizacion.total,
    totalPresentacion: cotizacion.totalPresentacion,
  };
}

export function puedeMarcarEnviada(estado: string): boolean {
  return estado === 'APROBADA';
}

export function puedeRegistrarResultado(estado: string): boolean {
  return estado === 'ENVIADA' || estado === 'VENCIDA';
}

export function puedeAnular(estado: string): boolean {
  return (
    estado === 'BORRADOR' ||
    estado === 'APROBADA' ||
    estado === 'ENVIADA'
  );
}

export function puedeCopiarWhatsApp(estado: string): boolean {
  return (
    estado === 'APROBADA' ||
    estado === 'ENVIADA' ||
    estado === 'GANADA' ||
    estado === 'PERDIDA' ||
    estado === 'VENCIDA'
  );
}

export function mensajeErrorApi(
  err: unknown,
  fallback: string,
): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
