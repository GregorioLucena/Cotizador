import { describe, expect, it } from 'vitest';
import {
  cantidadPorEstadoVacia,
  medianaMs,
  tasaComoCadena,
} from '../schemas/historial-metricas.schemas';

describe('medianaMs', () => {
  it('devuelve null si no hay valores', () => {
    expect(medianaMs([])).toBeNull();
    expect(medianaMs([-1])).toBeNull();
  });

  it('mediana impar', () => {
    expect(medianaMs([10 * 60_000, 20 * 60_000, 30 * 60_000])).toBe(
      20 * 60_000,
    );
  });

  it('mediana par promedia y redondea', () => {
    expect(medianaMs([10, 20])).toBe(15);
    expect(medianaMs([10, 11])).toBe(11);
  });
});

describe('tasaComoCadena', () => {
  it('division por cero', () => {
    expect(tasaComoCadena(0, 0)).toBe('0.0000');
    expect(tasaComoCadena(5, 0)).toBe('0.0000');
  });

  it('tasas del piloto', () => {
    expect(tasaComoCadena(7, 10)).toBe('0.7000');
    expect(tasaComoCadena(4, 10)).toBe('0.4000');
    expect(tasaComoCadena(3, 4)).toBe('0.7500');
  });
});

describe('cantidadPorEstadoVacia', () => {
  it('incluye todas las claves en cero', () => {
    const m = cantidadPorEstadoVacia();
    expect(Object.keys(m).sort()).toEqual(
      [
        'ANULADA',
        'APROBADA',
        'BORRADOR',
        'ENVIADA',
        'GANADA',
        'PERDIDA',
        'VENCIDA',
      ].sort(),
    );
    expect(Object.values(m).every((n) => n === 0)).toBe(true);
  });
});
