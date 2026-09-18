import { z } from 'zod';

export const LIST_PAGE_SIZE = 20;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(LIST_PAGE_SIZE),
  search: z.string().trim().optional(),
  estadoRegistro: z.enum(['ACTIVO', 'INACTIVO', 'TODOS']).default('ACTIVO'),
  perfilId: z.string().uuid().optional(),
});

export type ListQuerySchema = z.infer<typeof listQuerySchema>;
