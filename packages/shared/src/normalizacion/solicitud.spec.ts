import { describe, expect, it } from 'vitest';
import { normalizarTextoSolicitud } from './solicitud';

describe('normalizarTextoSolicitud', () => {
  it('elimina marca de hora, saludo y convierte media (CA-003)', () => {
    const original =
      '[10:15] Juan:\nbuenas, necesito 2 tubos de media\ngracias';
    const n = normalizarTextoSolicitud(original);
    expect(n).not.toMatch(/10:15/);
    expect(n).not.toMatch(/juan/i);
    expect(n).toContain('2 tubos de 1/2');
    expect(n).not.toMatch(/^buenas/);
    expect(n).not.toMatch(/gracias$/);
  });

  it('limpia viñetas y despedida', () => {
    const n = normalizarTextoSolicitud(
      'Hola!\n- 5m manguera negra\n- 1 llave de paso 1/2\nGracias',
    );
    expect(n).toContain('manguera negra');
    expect(n).toContain('llave de paso 1/2');
  });
});
