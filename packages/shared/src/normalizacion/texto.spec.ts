import { describe, expect, it } from 'vitest';
import { normalizarTexto, normalizarTextoBusqueda } from './texto';

describe('normalizarTexto', () => {
  it('recorta espacios y pasa a minúsculas', () => {
    expect(normalizarTexto('  Tubo  ')).toBe('tubo');
  });

  it('elimina acentos y convierte ñ en n', () => {
    expect(normalizarTexto('cañería')).toBe('caneria');
  });

  it('sustituye signos por espacio y colapsa espacios', () => {
    expect(normalizarTexto('tubo,  pvc')).toBe('tubo pvc');
  });

  it('aplica equivalencias de medidas', () => {
    expect(normalizarTexto('tubo de media')).toBe('tubo de 1/2');
    expect(normalizarTexto('tubo 0.5')).toBe('tubo 1/2');
  });

  it('preserva / y . en medidas', () => {
    expect(normalizarTexto('tubo 1/2"')).toMatch(/1\/2/);
  });
});

describe('normalizarTextoBusqueda', () => {
  it('concatena partes no vacías y normaliza', () => {
    expect(normalizarTextoBusqueda('Tubo', null, 'PVC', undefined, '  ')).toBe(
      'tubo pvc',
    );
  });
});
