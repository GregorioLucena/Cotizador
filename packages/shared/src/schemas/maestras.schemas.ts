import { z } from 'zod';

export const tipoDatoAtributoSchema = z.enum([
  'TEXTO',
  'NUMERO',
  'ENTERO',
  'BOOLEANO',
  'LISTA',
  'RANGO_ANIO',
]);

export const crearUnidadMedidaSchema = z.object({
  codigo: z.string().trim().min(1).max(10),
  nombre: z.string().trim().min(2).max(60),
  permiteDecimales: z.boolean(),
});

export const editarUnidadMedidaSchema = z
  .object({
    codigo: z.string().trim().min(1).max(10).optional(),
    nombre: z.string().trim().min(2).max(60).optional(),
    permiteDecimales: z.boolean().optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.codigo !== undefined ||
      v.nombre !== undefined ||
      v.permiteDecimales !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const crearCategoriaSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  categoriaPadreId: z.string().uuid().nullable().optional(),
  orden: z.number().int().min(0).optional(),
});

export const editarCategoriaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    categoriaPadreId: z.string().uuid().nullable().optional(),
    orden: z.number().int().min(0).optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.nombre !== undefined ||
      v.categoriaPadreId !== undefined ||
      v.orden !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const crearMarcaSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
});

export const editarMarcaSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) => v.nombre !== undefined || v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const crearDefinicionAtributoSchema = z
  .object({
    codigo: z.string().trim().min(1).max(40),
    etiqueta: z.string().trim().min(2).max(80),
    tipoDato: tipoDatoAtributoSchema,
    opciones: z.array(z.string().trim().min(1).max(60)).optional(),
    unidadSugerida: z.string().trim().min(1).max(20).optional(),
    requerido: z.boolean(),
    usarEnBusqueda: z.boolean(),
    orden: z.number().int().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipoDato === 'LISTA') {
      if (!v.opciones || v.opciones.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LISTA requiere al menos una opción',
          path: ['opciones'],
        });
      } else {
        const lower = v.opciones.map((o) => o.toLowerCase());
        if (new Set(lower).size !== lower.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Las opciones no pueden duplicarse',
            path: ['opciones'],
          });
        }
      }
    } else if (v.opciones !== undefined && v.opciones.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'opciones solo aplica a LISTA',
        path: ['opciones'],
      });
    }
  });

export const editarDefinicionAtributoSchema = z
  .object({
    codigo: z.string().trim().min(1).max(40).optional(),
    etiqueta: z.string().trim().min(2).max(80).optional(),
    tipoDato: tipoDatoAtributoSchema.optional(),
    opciones: z.array(z.string().trim().min(1).max(60)).nullable().optional(),
    unidadSugerida: z.string().trim().min(1).max(20).nullable().optional(),
    requerido: z.boolean().optional(),
    usarEnBusqueda: z.boolean().optional(),
    orden: z.number().int().min(0).optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.codigo !== undefined ||
      v.etiqueta !== undefined ||
      v.tipoDato !== undefined ||
      v.opciones !== undefined ||
      v.unidadSugerida !== undefined ||
      v.requerido !== undefined ||
      v.usarEnBusqueda !== undefined ||
      v.orden !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const categoriasListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).default('ACTIVO'),
  soloRaices: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  padreId: z.string().uuid().optional(),
});

export type CrearUnidadMedidaInput = z.infer<typeof crearUnidadMedidaSchema>;
export type EditarUnidadMedidaInput = z.infer<typeof editarUnidadMedidaSchema>;
export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;
export type EditarCategoriaInput = z.infer<typeof editarCategoriaSchema>;
export type CrearMarcaInput = z.infer<typeof crearMarcaSchema>;
export type EditarMarcaInput = z.infer<typeof editarMarcaSchema>;
export type CrearDefinicionAtributoInput = z.infer<typeof crearDefinicionAtributoSchema>;
export type EditarDefinicionAtributoInput = z.infer<typeof editarDefinicionAtributoSchema>;
