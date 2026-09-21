import { z } from 'zod';

const MAX_TEXTO = 4000;

export const canalSolicitudSchema = z.enum([
  'WHATSAPP_PEGADO',
  'MANUAL',
  'API',
]);

/**
 * Entrada de POST /api/precotizaciones.
 * `clienteId` o `nombreClienteLibre` se exige en el servicio (CLIENTE_O_NOMBRE_REQUERIDO).
 */
export const crearPrecotizacionSchema = z.object({
  textoOriginal: z.string().max(MAX_TEXTO + 100), // el servicio valida vacío/largo con códigos propios
  clienteId: z.string().uuid().optional(),
  nombreClienteLibre: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  telefonoClienteLibre: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  listaPrecioId: z.string().uuid().optional(),
  sucursalId: z.string().uuid().optional(),
  canal: canalSolicitudSchema.optional(),
});


export type CrearPrecotizacionInput = z.infer<typeof crearPrecotizacionSchema>;

export const reprocesarPrecotizacionSchema = z.object({
  /** Borrador a reescribir; no se crea otra cotización. */
  cotizacionId: z.string().uuid(),
  listaPrecioId: z.string().uuid().optional(),
  sucursalId: z.string().uuid().optional(),
});

export type ReprocesarPrecotizacionInput = z.infer<
  typeof reprocesarPrecotizacionSchema
>;

/** Cantidad decimal > 0 con hasta 4 decimales, como cadena. */
const cantidadDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Cantidad decimal inválida')
  .refine((v) => Number(v) > 0, { message: 'La cantidad debe ser mayor que cero' });

/**
 * Contrato estricto de salida de IA: sin precios, ids de catálogo ni totales.
 * `.strict()` rechaza claves desconocidas.
 */
export const lineaExtraidaSchema = z
  .object({
    textoSolicitado: z.string().trim().min(1).max(500),
    cantidad: cantidadDecimalSchema,
    unidad: z.string().trim().min(1).max(20).optional(),
    notas: z.string().trim().max(500).optional(),
  })
  .strict();

export const resultadoExtraccionSchema = z
  .object({
    lineas: z.array(lineaExtraidaSchema).max(40),
    advertencias: z.array(z.string()).default([]),
    metricas: z
      .object({
        latenciaMs: z.number().int().min(0),
        tokensEntrada: z.number().int().min(0).optional(),
        tokensSalida: z.number().int().min(0).optional(),
        costoEstimado: z.number().min(0).optional(),
      })
      .strict(),
  })
  .strict();

export type LineaExtraida = z.infer<typeof lineaExtraidaSchema>;
export type ResultadoExtraccion = z.infer<typeof resultadoExtraccionSchema>;

export const LIMITE_LINEAS_EXTRACCION = 40;
export const MAX_TEXTO_SOLICITUD = MAX_TEXTO;
export const VERSION_PROMPT_EXTRACCION = 'extraccion-lineas.v1';
