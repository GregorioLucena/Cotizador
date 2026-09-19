import { z } from 'zod';

export const tipoItemSchema = z.enum(['FUNGIBLE', 'SERIALIZADO', 'SERVICIO']);
export const origenAliasSchema = z.enum(['MANUAL', 'IMPORTADO', 'APRENDIDO']);

const rangoAnioSchema = z.object({
  desde: z.number().int(),
  hasta: z.number().int(),
});

const valorAtributoSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  rangoAnioSchema,
  z.null(),
]);

const stockAproximadoSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'Debe ser decimal con hasta 4 decimales')
  .optional();

export const crearItemSchema = z.object({
  sku: z.string().trim().min(1).max(60).optional(),
  nombre: z.string().trim().min(3).max(200),
  descripcion: z.string().trim().max(2000).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  marcaId: z.string().uuid().nullable().optional(),
  unidadMedidaId: z.string().uuid(),
  tipoItem: tipoItemSchema.optional(),
  atributos: z.record(valorAtributoSchema).optional(),
  controlaStock: z.boolean().optional(),
  stockAproximado: stockAproximadoSchema.nullable().optional(),
  alias: z.array(z.string().trim().min(2).max(200)).max(50).optional(),
});

export const editarItemSchema = z
  .object({
    sku: z.string().trim().min(1).max(60).nullable().optional(),
    nombre: z.string().trim().min(3).max(200).optional(),
    descripcion: z.string().trim().max(2000).nullable().optional(),
    categoriaId: z.string().uuid().nullable().optional(),
    marcaId: z.string().uuid().nullable().optional(),
    unidadMedidaId: z.string().uuid().optional(),
    tipoItem: tipoItemSchema.optional(),
    atributos: z.record(valorAtributoSchema).optional(),
    controlaStock: z.boolean().optional(),
    stockAproximado: stockAproximadoSchema.nullable().optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.sku !== undefined ||
      v.nombre !== undefined ||
      v.descripcion !== undefined ||
      v.categoriaId !== undefined ||
      v.marcaId !== undefined ||
      v.unidadMedidaId !== undefined ||
      v.tipoItem !== undefined ||
      v.atributos !== undefined ||
      v.controlaStock !== undefined ||
      v.stockAproximado !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const crearAliasSchema = z.object({
  alias: z.string().trim().min(2).max(200),
  origen: origenAliasSchema.optional(),
  /** Obligatorio en true cuando origen es APRENDIDO (alta directa). */
  confirmado: z.boolean().optional(),
});

export const crearAplicacionSchema = z.object({
  datos: z
    .record(z.union([z.string(), z.number()]))
    .refine((d) => Object.keys(d).length >= 1, {
      message: 'datos debe tener al menos una clave',
    })
    .refine((d) => Object.keys(d).length <= 20, {
      message: 'datos admite como máximo 20 claves',
    }),
});

export const editarAplicacionSchema = z.object({
  datos: z
    .record(z.union([z.string(), z.number()]))
    .refine((d) => Object.keys(d).length >= 1, {
      message: 'datos debe tener al menos una clave',
    })
    .refine((d) => Object.keys(d).length <= 20, {
      message: 'datos admite como máximo 20 claves',
    }),
});

export const buscarItemsQuerySchema = z.object({
  q: z.string().trim().min(1),
  categoriaId: z.string().uuid().optional(),
  marcaId: z.string().uuid().optional(),
  tipoItem: tipoItemSchema.optional(),
  listaPrecioId: z.string().uuid().optional(),
  conPrecio: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v === true || v === 'true',
    ),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(25),
  // pares atributo: atributo.codigo=valor en query se parsean aparte
});

export const listarItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  categoriaId: z.string().uuid().optional(),
  marcaId: z.string().uuid().optional(),
  tipoItem: tipoItemSchema.optional(),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).default('ACTIVO'),
  orden: z.enum(['nombre', 'sku', 'updatedAt']).default('nombre'),
  direccion: z.enum(['ASC', 'DESC']).default('ASC'),
});

export const cerrarTerminoSchema = z
  .object({
    accion: z.enum(['CREAR_ALIAS', 'DESCARTAR']),
    itemId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.accion === 'CREAR_ALIAS' && !v.itemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'itemId es obligatorio cuando la acción es CREAR_ALIAS',
        path: ['itemId'],
      });
    }
  });

export const listarTerminosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).default('ACTIVO'),
});

export type CrearItemInput = z.infer<typeof crearItemSchema>;
export type EditarItemInput = z.infer<typeof editarItemSchema>;
export type CrearAliasInput = z.infer<typeof crearAliasSchema>;
export type CrearAplicacionInput = z.infer<typeof crearAplicacionSchema>;
export type EditarAplicacionInput = z.infer<typeof editarAplicacionSchema>;
export type BuscarItemsQuery = z.infer<typeof buscarItemsQuerySchema>;
export type ListarItemsQuery = z.infer<typeof listarItemsQuerySchema>;
export type CerrarTerminoInput = z.infer<typeof cerrarTerminoSchema>;
