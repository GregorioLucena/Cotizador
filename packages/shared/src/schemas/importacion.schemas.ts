import { z } from 'zod';

export const tipoImportacionSchema = z.enum(['ITEMS', 'PRECIOS', 'ALIAS']);
export const estadoImportacionSchema = z.enum([
  'CARGADA',
  'VALIDADA',
  'CONFIRMADA',
  'FALLIDA',
  'CANCELADA',
]);

export const mapeoColumnasSchema = z
  .record(z.union([z.string().min(1), z.number().int().min(0)]))
  .refine((m) => Object.keys(m).length > 0, {
    message: 'El mapeo debe tener al menos un campo',
  });

/** Filas por petición al confirmar (permite barra de progreso en el cliente). */
export const LOTE_CONFIRMACION_DEFAULT = 40;
export const LOTE_CONFIRMACION_MAX = 200;

export const confirmarImportacionSchema = z.object({
  simular: z.boolean().optional().default(false),
  /** Tamaño del lote a persistir en esta petición (omitir/igual en simulación). */
  loteTamano: z.coerce
    .number()
    .int()
    .min(1)
    .max(LOTE_CONFIRMACION_MAX)
    .optional()
    .default(LOTE_CONFIRMACION_DEFAULT),
});

export const listarImportacionesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tipo: tipoImportacionSchema.optional(),
  estado: estadoImportacionSchema.optional(),
});

export const plantillaImportacionQuerySchema = z.object({
  tipo: tipoImportacionSchema,
});

export type TipoImportacion = z.infer<typeof tipoImportacionSchema>;
export type MapeoColumnas = z.infer<typeof mapeoColumnasSchema>;
export type ConfirmarImportacionInput = z.infer<typeof confirmarImportacionSchema>;

export const CAMPOS_OBLIGATORIOS_MAPEO: Record<TipoImportacion, string[]> = {
  ITEMS: ['nombre', 'unidadCodigo'],
  PRECIOS: ['sku', 'listaPrecioCodigo', 'precio'],
  ALIAS: ['sku', 'alias'],
};

export const LIMITE_FILAS_IMPORTACION = 2000;
export const LIMITE_TAMANO_ARCHIVO_BYTES = 5 * 1024 * 1024;
export const LIMITE_ALIAS_POR_CELDA = 20;
