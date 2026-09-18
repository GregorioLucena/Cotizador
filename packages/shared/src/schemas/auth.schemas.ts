import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva: z.string().min(1),
});

export const sucursalActivaSchema = z.object({
  sucursalId: z.string().uuid(),
});

export const crearUsuarioSchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(120),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  telefono: z.string().trim().min(1).max(40).optional(),
  perfilIds: z.array(z.string().uuid()).min(1),
  sucursalIds: z.array(z.string().uuid()).min(1),
  passwordTemporal: z.string().min(1).optional(),
});

export const editarUsuarioSchema = z
  .object({
    nombreCompleto: z.string().trim().min(3).max(120).optional(),
    telefono: z.string().trim().min(1).max(40).nullable().optional(),
    perfilIds: z.array(z.string().uuid()).min(1).optional(),
    sucursalIds: z.array(z.string().uuid()).min(1).optional(),
    estadoRegistro: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  })
  .refine(
    (v) =>
      v.nombreCompleto !== undefined ||
      v.telefono !== undefined ||
      v.perfilIds !== undefined ||
      v.sucursalIds !== undefined ||
      v.estadoRegistro !== undefined,
    { message: 'Debe enviar al menos un campo para editar' },
  );

export const restablecerPasswordSchema = z.object({
  passwordTemporal: z.string().min(1).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
export type SucursalActivaInput = z.infer<typeof sucursalActivaSchema>;
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
export type RestablecerPasswordInput = z.infer<typeof restablecerPasswordSchema>;
