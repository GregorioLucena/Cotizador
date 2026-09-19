import { z } from 'zod';

const optionalNullableString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v));

const optionalEmail = z
  .union([
    z.string().trim().email('Correo no válido').max(254),
    z.null(),
    z.literal(''),
  ])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(2).max(160),
  telefonoWhatsapp: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  email: optionalEmail,
  identificacionFiscal: z
    .union([
      z.string().trim().min(3).max(40),
      z.null(),
      z.literal(''),
    ])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  listaPrecioId: z
    .union([z.string().uuid(), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v)),
  direccion: optionalNullableString(300),
  notas: optionalNullableString(2000),
  /** Marca UX de alta ocasional; habilita reutilización por WhatsApp. */
  ocasional: z.boolean().optional(),
  /** Si es true (o ocasional), reutiliza cliente existente con el mismo WhatsApp. */
  reutilizar: z.boolean().optional(),
});

export const editarClienteSchema = z
  .object({
    nombre: z.string().trim().min(2).max(160).optional(),
    telefonoWhatsapp: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => (v === '' ? null : v)),
    email: optionalEmail,
    identificacionFiscal: z
      .union([
        z.string().trim().min(3).max(40),
        z.null(),
        z.literal(''),
      ])
      .optional()
      .transform((v) => (v === '' ? null : v)),
    listaPrecioId: z.union([z.string().uuid(), z.null()]).optional(),
    direccion: optionalNullableString(300),
    notas: optionalNullableString(2000),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.nombre !== undefined ||
      v.telefonoWhatsapp !== undefined ||
      v.email !== undefined ||
      v.identificacionFiscal !== undefined ||
      v.listaPrecioId !== undefined ||
      v.direccion !== undefined ||
      v.notas !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const clientesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).default('ACTIVO'),
  orden: z.enum(['recientes', 'nombre']).default('recientes'),
});

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type EditarClienteInput = z.infer<typeof editarClienteSchema>;
export type ClientesListQuery = z.infer<typeof clientesListQuerySchema>;
