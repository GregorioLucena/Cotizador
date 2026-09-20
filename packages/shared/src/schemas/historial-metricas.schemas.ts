import { z } from 'zod';

export const ESTADOS_COTIZACION = [
  'BORRADOR',
  'APROBADA',
  'ENVIADA',
  'GANADA',
  'PERDIDA',
  'VENCIDA',
  'ANULADA',
] as const;

export type EstadoCotizacionCodigo = (typeof ESTADOS_COTIZACION)[number];

const estadoCotizacionSchema = z.enum(ESTADOS_COTIZACION);

/** Uno o varios estados: `ENVIADA` o `ENVIADA,VENCIDA` o array. */
const estadosFiltroSchema = z.preprocess((val) => {
  if (val == null || val === '') return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return val;
}, z.array(estadoCotizacionSchema).min(1).optional());

const boolQuerySchema = z.preprocess((val) => {
  if (val == null || val === '') return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const n = val.trim().toLowerCase();
    if (n === 'true' || n === '1') return true;
    if (n === 'false' || n === '0') return false;
  }
  return val;
}, z.boolean().optional());

export const listarCotizacionesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estado: estadosFiltroSchema,
  clienteId: z.string().uuid().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  usuarioId: z.string().uuid().optional(),
  rolUsuario: z.enum(['CAPTURADOR', 'APROBADOR']).optional(),
  sucursalId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  anulado: boolQuerySchema,
});

export type ListarCotizacionesQuery = z.infer<
  typeof listarCotizacionesQuerySchema
>;

export const periodoReporteQuerySchema = z
  .object({
    desde: z.coerce.date().optional(),
    hasta: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    detalle: boolQuerySchema,
  })
  .superRefine((v, ctx) => {
    if (v.desde && v.hasta && v.desde.getTime() > v.hasta.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'desde no puede ser posterior a hasta',
        path: ['desde'],
      });
    }
  });

export type PeriodoReporteQuery = z.infer<typeof periodoReporteQuerySchema>;

export type CantidadPorEstado = Record<EstadoCotizacionCodigo, number>;

export type CotizacionesResumen = {
  periodo: { desde: string; hasta: string };
  cantidadPorEstado: CantidadPorEstado;
  tiempoMedianoCapturaAprobacionMs: number | null;
  montoTotalAprobado: string;
  montoGanado: string;
  montoPerdido: string;
  conversion: string;
  vencidasPendientesDeMarca: number;
};

export type DesempenoReconocimiento = {
  periodo: { desde: string; hasta: string };
  lineasTotales: number;
  lineasAutomaticas: number;
  eventosCorreccion: number;
  tasaAutomaticas: string;
  tasaCorreccion: string;
};

export type TerminoFallido = {
  textoNormalizado: string;
  ejemploOriginal: string;
  vecesVisto: number;
  resueltoConItemId: string | null;
};

export type MetricasPlataforma = {
  periodo: { desde: string; hasta: string };
  organizacionesActivas: number;
  cotizacionesTotales: number;
  aprobadasTotales: number;
  tasaAprobacionGlobal: string;
  tiempoMedianoGlobalMs: number | null;
  ganadasTotales: number;
  perdidasTotales: number;
  porOrganizacion?: Array<{
    organizacionId: string;
    nombre: string;
    cotizaciones: number;
    aprobadas: number;
    ganadas: number;
    perdidas: number;
  }>;
};

/** Mapa vacío con ceros para todos los estados del glosario. */
export function cantidadPorEstadoVacia(): CantidadPorEstado {
  return {
    BORRADOR: 0,
    APROBADA: 0,
    ENVIADA: 0,
    GANADA: 0,
    PERDIDA: 0,
    VENCIDA: 0,
    ANULADA: 0,
  };
}

/** Tasa en [0, 1] como cadena con 4 decimales; división por cero → "0.0000". */
export function tasaComoCadena(numerador: number, denominador: number): string {
  if (denominador <= 0) return '0.0000';
  return (Math.round((numerador / denominador) * 10000) / 10000).toFixed(4);
}

/**
 * Mediana de duraciones en ms. Conjunto par: promedio de los dos centrales,
 * redondeado al milisegundo más cercano. Vacío → null.
 */
export function medianaMs(valores: number[]): number | null {
  const validos = valores.filter((v) => Number.isFinite(v) && v >= 0);
  if (validos.length === 0) return null;
  const sorted = [...validos].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}
