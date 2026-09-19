import { z } from 'zod';

const decimal4Positive = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, 'Debe ser un decimal con hasta 4 decimales')
  .refine((v) => Number(v) > 0, { message: 'Debe ser mayor que cero' });

const decimal4NonNegative = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, 'Debe ser un decimal con hasta 4 decimales')
  .refine((v) => Number(v) >= 0, { message: 'No puede ser negativo' });

const decimal6Positive = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,6})?$/, 'Debe ser un decimal con hasta 6 decimales')
  .refine((v) => Number(v) > 0, { message: 'Debe ser mayor que cero' });

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha ISO (YYYY-MM-DD)');

export const ambitoReglaSchema = z.enum(['ITEM', 'CATEGORIA', 'MARCA', 'GLOBAL']);
export const tipoDescuentoSchema = z.enum([
  'PORCENTAJE',
  'MONTO_FIJO',
  'PRECIO_FIJO',
]);
export const fuenteTasaSchema = z.enum(['MANUAL', 'AUTOMATICA']);

export const crearListaPrecioSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80),
    codigo: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9_-]+$/.test(v), {
        message: 'Código: solo A-Z, 0-9, _ y -',
      }),
    monedaId: z.string().uuid(),
    esPredeterminada: z.boolean().optional(),
    vigenciaDesde: isoDate.optional(),
    vigenciaHasta: isoDate.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.vigenciaDesde && v.vigenciaHasta && v.vigenciaHasta < v.vigenciaDesde) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'vigenciaHasta no puede ser anterior a vigenciaDesde',
        path: ['vigenciaHasta'],
      });
    }
  });

export const editarListaPrecioSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    codigo: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9_-]+$/.test(v), {
        message: 'Código: solo A-Z, 0-9, _ y -',
      })
      .optional(),
    monedaId: z.string().uuid().optional(),
    esPredeterminada: z.boolean().optional(),
    vigenciaDesde: isoDate.nullable().optional(),
    vigenciaHasta: isoDate.nullable().optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.nombre !== undefined ||
      v.codigo !== undefined ||
      v.monedaId !== undefined ||
      v.esPredeterminada !== undefined ||
      v.vigenciaDesde !== undefined ||
      v.vigenciaHasta !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const upsertPrecioSchema = z.object({
  itemId: z.string().uuid(),
  precio: decimal4Positive,
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

export const crearReglaDescuentoSchema = z
  .object({
    listaPrecioId: z.string().uuid().nullable().optional(),
    nombre: z.string().trim().min(2).max(120),
    ambito: ambitoReglaSchema,
    referenciaId: z.string().uuid().optional(),
    cantidadMinima: decimal4NonNegative.optional(),
    cantidadMaxima: decimal4NonNegative.nullable().optional(),
    tipoDescuento: tipoDescuentoSchema,
    valor: z.string().trim(),
    prioridad: z.number().int(),
    vigenciaDesde: isoDate.optional(),
    vigenciaHasta: isoDate.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.ambito !== 'GLOBAL' && !v.referenciaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'referenciaId es obligatorio salvo GLOBAL',
        path: ['referenciaId'],
      });
    }
    if (v.ambito === 'GLOBAL' && v.referenciaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GLOBAL no admite referenciaId',
        path: ['referenciaId'],
      });
    }
    if (
      v.cantidadMinima !== undefined &&
      v.cantidadMaxima != null &&
      Number(v.cantidadMaxima) < Number(v.cantidadMinima)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cantidadMaxima debe ser >= cantidadMinima',
        path: ['cantidadMaxima'],
      });
    }
    if (v.vigenciaDesde && v.vigenciaHasta && v.vigenciaHasta < v.vigenciaDesde) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'vigenciaHasta no puede ser anterior a vigenciaDesde',
        path: ['vigenciaHasta'],
      });
    }
    const valorNum = Number(v.valor);
    if (!/^\d+(\.\d{1,4})?$/.test(v.valor.trim()) || Number.isNaN(valorNum)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'valor decimal inválido',
        path: ['valor'],
      });
      return;
    }
    if (v.tipoDescuento === 'PORCENTAJE') {
      if (valorNum < 0 || valorNum > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Porcentaje entre 0 y 100',
          path: ['valor'],
        });
      }
    } else if (valorNum <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor debe ser mayor que cero',
        path: ['valor'],
      });
    }
  });

export const editarReglaDescuentoSchema = z
  .object({
    listaPrecioId: z.string().uuid().nullable().optional(),
    nombre: z.string().trim().min(2).max(120).optional(),
    ambito: ambitoReglaSchema.optional(),
    referenciaId: z.string().uuid().nullable().optional(),
    cantidadMinima: decimal4NonNegative.optional(),
    cantidadMaxima: decimal4NonNegative.nullable().optional(),
    tipoDescuento: tipoDescuentoSchema.optional(),
    valor: z.string().trim().optional(),
    prioridad: z.number().int().optional(),
    vigenciaDesde: isoDate.nullable().optional(),
    vigenciaHasta: isoDate.nullable().optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.listaPrecioId !== undefined ||
      v.nombre !== undefined ||
      v.ambito !== undefined ||
      v.referenciaId !== undefined ||
      v.cantidadMinima !== undefined ||
      v.cantidadMaxima !== undefined ||
      v.tipoDescuento !== undefined ||
      v.valor !== undefined ||
      v.prioridad !== undefined ||
      v.vigenciaDesde !== undefined ||
      v.vigenciaHasta !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const crearTasaCambioSchema = z
  .object({
    monedaOrigenId: z.string().uuid(),
    monedaDestinoId: z.string().uuid(),
    valor: decimal6Positive,
    fechaVigencia: isoDate,
    fuente: z.literal('MANUAL').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.monedaOrigenId === v.monedaDestinoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Origen y destino deben ser distintos',
        path: ['monedaDestinoId'],
      });
    }
  });

export const tasasListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).default('ACTIVO'),
  monedaOrigenId: z.string().uuid().optional(),
  monedaDestinoId: z.string().uuid().optional(),
  fechaReferencia: isoDate.optional(),
  vigente: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export type CrearListaPrecioInput = z.infer<typeof crearListaPrecioSchema>;
export type EditarListaPrecioInput = z.infer<typeof editarListaPrecioSchema>;
export type UpsertPrecioInput = z.infer<typeof upsertPrecioSchema>;
export type CrearReglaDescuentoInput = z.infer<typeof crearReglaDescuentoSchema>;
export type EditarReglaDescuentoInput = z.infer<typeof editarReglaDescuentoSchema>;
export type CrearTasaCambioInput = z.infer<typeof crearTasaCambioSchema>;
