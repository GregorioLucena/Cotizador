import { describe, expect, it } from 'vitest';
import type { OrgContext } from '../types/org-context';
import { hasPermission } from './index';

function ctx(permisos: string[]): OrgContext {
  return {
    usuarioId: 'u1',
    organizacionId: 'o1',
    ambito: 'ORGANIZACION',
    sucursalIds: [],
    permisos,
    sesionId: 's1',
  };
}

describe('hasPermission', () => {
  it('catalogo.* satisface catalogo.items.crear', () => {
    expect(hasPermission(ctx(['catalogo.*']), 'catalogo.items.crear')).toBe(true);
  });

  it('catalogo.items.* no satisface precios.listas.ver', () => {
    expect(hasPermission(ctx(['catalogo.items.*']), 'precios.listas.ver')).toBe(false);
  });

  it('un patrón sin punto antes del comodín no es válido como comodín', () => {
    expect(hasPermission(ctx(['catalogo.item*']), 'catalogo.items.crear')).toBe(false);
  });

  it('coincide exacta', () => {
    expect(hasPermission(ctx(['reportes.ver']), 'reportes.ver')).toBe(true);
  });
});
