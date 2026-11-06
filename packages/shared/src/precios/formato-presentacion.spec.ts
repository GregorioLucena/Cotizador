import { describe, expect, it } from 'vitest';
import {
  formatearCantidadPresentacion,
  formatearImportePresentacion,
} from './formato-presentacion';

function esperado(n: number, decimales: number, locale = 'es-VE'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

describe('formatearImportePresentacion', () => {
  it('redondea a los decimales de la organización en el locale', () => {
    expect(formatearImportePresentacion('10.5049', 2)).toBe(esperado(10.5, 2));
    expect(formatearImportePresentacion('10.505', 2)).toBe(esperado(10.51, 2));
    expect(formatearImportePresentacion('1852.3750', 2)).toBe(esperado(1852.38, 2));
    expect(formatearImportePresentacion('140.0000', 0)).toBe(esperado(140, 0));
  });

  it('respeta el modo de redondeo', () => {
    expect(formatearImportePresentacion('10.501', 2, { modo: 'ARRIBA' })).toBe(
      esperado(10.51, 2),
    );
    expect(formatearImportePresentacion('10.509', 2, { modo: 'ABAJO' })).toBe(
      esperado(10.5, 2),
    );
  });

  it('vacío se muestra como raya', () => {
    expect(formatearImportePresentacion(null, 2)).toBe('—');
    expect(formatearImportePresentacion('', 2)).toBe('—');
  });
});

describe('formatearCantidadPresentacion', () => {
  it('quita ceros de relleno y conserva la parte decimal útil', () => {
    expect(formatearCantidadPresentacion('10.0000')).toBe('10');
    expect(formatearCantidadPresentacion('2.5000')).toBe('2.5');
  });
});
