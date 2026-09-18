import type { OrgContext } from '../types/org-context';
import { ForbiddenError } from '../errors';

export { PERMISOS, PERMISOS_DESCRIPCION } from './constants';
export type { PermisoCodigo } from './constants';

export function hasPermission(ctx: OrgContext, codigo: string): boolean {
  return ctx.permisos.some((permiso) => {
    if (permiso === codigo) return true;
    if (permiso.endsWith('.*')) {
      const prefix = permiso.slice(0, -1);
      return codigo.startsWith(prefix);
    }
    return false;
  });
}

export function requirePermission(ctx: OrgContext, codigo: string): void {
  if (!hasPermission(ctx, codigo)) {
    throw new ForbiddenError();
  }
}
