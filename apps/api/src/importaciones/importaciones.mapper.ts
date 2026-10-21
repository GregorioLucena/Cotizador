import type { ImportacionCatalogo } from '@cotizador/database';

export type ErrorFilaImportacionDto = {
  fila: number;
  campo?: string;
  codigo: string;
  mensaje: string;
  valorRecibido?: string;
};

export type ProgresoConfirmacionDto = {
  procesadas: number;
  total: number;
  porcentaje: number;
  terminado: boolean;
};

export type ResumenImportacionDto = {
  altas?: number;
  actualizaciones?: number;
  omitidas?: number;
  filasAplicadas?: number;
  filasOmitidas?: number;
  filasActualizadas?: number;
  advertencias?: string[];
  simulado?: boolean;
  /** Índice (0-based) de la siguiente fila válida a persistir. */
  confirmOffset?: number;
  progreso?: ProgresoConfirmacionDto;
};

export function mapImportacion(imp: ImportacionCatalogo) {
  return {
    id: imp.id,
    tipo: imp.tipo,
    nombreArchivo: imp.nombreArchivo,
    nombreHoja: imp.nombreHoja ?? null,
    estado: imp.estado,
    filasTotales: imp.filasTotales,
    filasValidas: imp.filasValidas,
    filasConError: imp.filasConError,
    mapeoColumnas: imp.mapeoColumnas,
    erroresDetalle: (imp.erroresDetalle ?? []) as ErrorFilaImportacionDto[],
    resumen: (imp.resumen as ResumenImportacionDto | null) ?? null,
    createdAt: imp.createdAt.toISOString(),
    updatedAt: imp.updatedAt.toISOString(),
  };
}
