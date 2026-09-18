import { z } from 'zod';

const umbralSchema = z.union([
  z.string().trim().min(1),
  z.number(),
]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n) || n < 0 || n > 1) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: [],
        message: 'Los umbrales deben estar entre 0 y 1',
      },
    ]);
  }
  return n.toFixed(4);
});

export const crearOrganizacionSchema = z
  .object({
    nombre: z.string().trim().min(3).max(120),
    razonSocial: z.string().trim().min(1).max(200).optional(),
    identificacionFiscal: z.string().trim().min(1).max(40).optional(),
    verticalId: z.string().uuid(),
    telefono: z.string().trim().min(1).max(40).optional(),
    email: z.string().email().optional(),
    direccion: z.string().trim().min(1).max(500).optional(),
    monedaBaseId: z.string().uuid(),
    monedaPresentacionId: z.string().uuid().optional(),
    zonaHoraria: z.string().trim().min(3).max(80).default('America/Caracas'),
    locale: z.string().trim().min(2).max(20).default('es-VE'),
    usaIa: z.boolean().default(true),
    umbralAutomatico: umbralSchema.default('0.8000'),
    umbralDescarte: umbralSchema.default('0.4500'),
    notasInternas: z.string().trim().max(2000).optional(),
    sucursalPrincipal: z
      .object({
        nombre: z.string().trim().min(1).max(120),
        codigo: z.string().trim().min(1).max(20),
        direccion: z.string().trim().max(500).optional(),
        telefono: z.string().trim().max(40).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.monedaPresentacionId &&
      data.monedaPresentacionId === data.monedaBaseId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monedaPresentacionId'],
        message: 'La moneda de presentación debe ser distinta de la moneda base',
      });
    }
    const auto = Number(data.umbralAutomatico);
    const desc = Number(data.umbralDescarte);
    if (!(desc < auto)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['umbralDescarte'],
        message: 'El umbral de descarte debe ser menor que el umbral automático',
      });
    }
  });

export const editarOrganizacionSchema = z
  .object({
    nombre: z.string().trim().min(3).max(120).optional(),
    razonSocial: z.string().trim().min(1).max(200).nullable().optional(),
    identificacionFiscal: z.string().trim().min(1).max(40).nullable().optional(),
    verticalId: z.string().uuid().optional(),
    telefono: z.string().trim().min(1).max(40).nullable().optional(),
    email: z.string().email().nullable().optional(),
    direccion: z.string().trim().min(1).max(500).nullable().optional(),
    monedaBaseId: z.string().uuid().optional(),
    monedaPresentacionId: z.string().uuid().nullable().optional(),
    zonaHoraria: z.string().trim().min(3).max(80).optional(),
    locale: z.string().trim().min(2).max(20).optional(),
    usaIa: z.boolean().optional(),
    umbralAutomatico: umbralSchema.optional(),
    umbralDescarte: umbralSchema.optional(),
    notasInternas: z.string().trim().max(2000).nullable().optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
    confirmarCambioMonedaBase: z.boolean().optional(),
  })
  .refine(
    (v) => Object.values(v).some((x) => x !== undefined),
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const crearUsuarioInicialSchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(120),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  telefono: z.string().trim().min(1).max(40).optional(),
  passwordTemporal: z.string().min(1).optional(),
});

export const metricasQuerySchema = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export type CrearOrganizacionInput = z.infer<typeof crearOrganizacionSchema>;
export type EditarOrganizacionInput = z.infer<typeof editarOrganizacionSchema>;
export type CrearUsuarioInicialInput = z.infer<typeof crearUsuarioInicialSchema>;
