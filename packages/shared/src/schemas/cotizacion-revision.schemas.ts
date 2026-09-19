import { z } from 'zod';

/** Cantidad decimal > 0 con hasta 4 decimales, como cadena. */
export const cantidadLineaSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Cantidad decimal inválida')
  .refine((v) => Number(v) > 0, { message: 'La cantidad debe ser mayor que cero' });

/** Importe con hasta 4 decimales. */
export const importeDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Importe decimal inválido');

export const totalesClienteParcialSchema = z.object({
  subtotal: importeDecimalSchema,
  total: importeDecimalSchema,
});

export const totalesClienteCompletosSchema = z.object({
  subtotal: importeDecimalSchema,
  descuentoTotal: importeDecimalSchema,
  impuestoTotal: importeDecimalSchema,
  total: importeDecimalSchema,
  totalPresentacion: importeDecimalSchema.nullable().optional(),
});

export const editarCabeceraCotizacionSchema = z
  .object({
    clienteId: z.string().uuid().nullable().optional(),
    nombreClienteLibre: z
      .string()
      .trim()
      .max(160)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    telefonoClienteLibre: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    listaPrecioId: z.string().uuid().optional(),
    observaciones: z
      .string()
      .trim()
      .max(4000)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    textoCondiciones: z
      .string()
      .trim()
      .max(4000)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    textoPie: z
      .string()
      .trim()
      .max(4000)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    totalesCliente: totalesClienteParcialSchema.optional(),
  })
  .strict();

export type EditarCabeceraCotizacionInput = z.infer<
  typeof editarCabeceraCotizacionSchema
>;

export const agregarLineaCotizacionSchema = z
  .object({
    itemId: z.string().uuid(),
    cantidad: cantidadLineaSchema,
    unidadMedidaId: z.string().uuid().optional(),
    textoSolicitado: z.string().trim().min(1).max(500).optional(),
    notas: z.string().trim().max(500).nullable().optional(),
    totalesCliente: totalesClienteParcialSchema.optional(),
  })
  .strict();

export type AgregarLineaCotizacionInput = z.infer<
  typeof agregarLineaCotizacionSchema
>;

export const editarLineaCotizacionSchema = z
  .object({
    itemId: z.string().uuid().optional(),
    candidatoItemId: z.string().uuid().optional(),
    cantidad: cantidadLineaSchema.optional(),
    unidadMedidaId: z.string().uuid().optional(),
    precioUnitario: importeDecimalSchema.optional(),
    motivoSobrescritura: z.string().trim().min(1).max(1000).optional(),
    quitarSobrescritura: z.boolean().optional(),
    guardarAlias: z.boolean().optional(),
    totalesCliente: totalesClienteParcialSchema.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.itemId !== undefined ||
      v.candidatoItemId !== undefined ||
      v.cantidad !== undefined ||
      v.unidadMedidaId !== undefined ||
      v.precioUnitario !== undefined ||
      v.quitarSobrescritura === true,
    { message: 'Debe indicar al menos un cambio en la línea' },
  );

export type EditarLineaCotizacionInput = z.infer<
  typeof editarLineaCotizacionSchema
>;

export const recalcularCotizacionSchema = z
  .object({
    totalesCliente: totalesClienteParcialSchema.optional(),
  })
  .strict();

export type RecalcularCotizacionInput = z.infer<
  typeof recalcularCotizacionSchema
>;

export const aprobarCotizacionSchema = z
  .object({
    totalesCliente: totalesClienteCompletosSchema.optional(),
  })
  .strict();

export type AprobarCotizacionInput = z.infer<typeof aprobarCotizacionSchema>;

export const registrarResultadoCotizacionSchema = z
  .object({
    resultado: z.enum(['GANADA', 'PERDIDA']),
    motivoPerdida: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type RegistrarResultadoCotizacionInput = z.infer<
  typeof registrarResultadoCotizacionSchema
>;

export const anularCotizacionSchema = z
  .object({
    motivoAnulacion: z.string().trim().min(1).max(2000),
  })
  .strict();

export type AnularCotizacionInput = z.infer<typeof anularCotizacionSchema>;

export const duplicarCotizacionSchema = z.object({}).strict();

export type DuplicarCotizacionInput = z.infer<typeof duplicarCotizacionSchema>;

export const MOTIVO_MIN_LENGTH = 10;
