export type EstadoResolucion =
  | 'RESUELTA_AUTOMATICA'
  | 'SUGERIDA_REVISAR'
  | 'NO_ENCONTRADA'
  | 'RESUELTA_MANUAL'
  | 'AGREGADA_MANUAL';

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
  estado: string;
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
  subtotal: string;
  descuentoTotal: string;
  impuestoTotal: string;
  total: string;
  totalPresentacion: string | null;
  porcentajeImpuestoAplicado: string;
  observaciones: string | null;
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
};

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
      return { label: 'Manual', tone: 'neutral' };
    default:
      return { label: estado, tone: 'neutral' };
  }
}
