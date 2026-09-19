import type { ImportacionCatalogo } from '@cotizador/database';

export type ErrorFilaImportacionDto = {
  fila: number;
  campo?: string;
  codigo: string;
  mensaje: string;
  valorRecibido?: string;
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
} | null;

export function mapImportacion(imp: ImportacionCatalogo) {
  return {
    id: imp.id,
    tipo: imp.tipo,
    nombreArchivo: imp.nombreArchivo,
    estado: imp.estado,
    filasTotales: imp.filasTotales,
    filasValidas: imp.filasValidas,
    filasConError: imp.filasConError,
    mapeoColumnas: imp.mapeoColumnas,
    erroresDetalle: (imp.erroresDetalle ?? []) as ErrorFilaImportacionDto[],
    resumen: (imp.resumen as ResumenImportacionDto) ?? null,
    createdAt: imp.createdAt.toISOString(),
    updatedAt: imp.updatedAt.toISOString(),
  };
}
