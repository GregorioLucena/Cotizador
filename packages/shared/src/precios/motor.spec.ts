import { describe, expect, it } from 'vitest';
import {
  aplicarDescuento,
  calcularCotizacion,
  calcularLinea,
  elegirRegla,
  type ConfiguracionCalculo,
  type ReglaDescuentoCalculo,
} from './motor';

const cfgBase: ConfiguracionCalculo = {
  aplicaImpuesto: true,
  porcentajeImpuesto: '16.0000',
  preciosIncluyenImpuesto: false,
  decimalesRedondeo: 2,
  modoRedondeo: 'NORMAL',
};

const reglaPct10: ReglaDescuentoCalculo = {
  id: 'regla-pct-10',
  ambito: 'GLOBAL',
  cantidadMinima: '1.0000',
  tipoDescuento: 'PORCENTAJE',
  valor: '10.0000',
  prioridad: 100,
  estadoRegistro: 'ACTIVO',
};

describe('aplicarDescuento', () => {
  it('PORCENTAJE', () => {
    expect(aplicarDescuento('100.0000', { tipoDescuento: 'PORCENTAJE', valor: '10.0000' })).toBe(
      '90.0000',
    );
  });

  it('MONTO_FIJO no baja de cero', () => {
    expect(aplicarDescuento('5.0000', { tipoDescuento: 'MONTO_FIJO', valor: '10.0000' })).toBe(
      '0.0000',
    );
  });

  it('PRECIO_FIJO', () => {
    expect(aplicarDescuento('100.0000', { tipoDescuento: 'PRECIO_FIJO', valor: '75.5000' })).toBe(
      '75.5000',
    );
  });
});

describe('elegirRegla — desempate', () => {
  it('mayor prioridad gana', () => {
    const global5: ReglaDescuentoCalculo = {
      id: 'g5',
      ambito: 'GLOBAL',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '5.0000',
      prioridad: 1,
    };
    const item2: ReglaDescuentoCalculo = {
      id: 'i2',
      ambito: 'ITEM',
      referenciaId: 'item-1',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '2.0000',
      prioridad: 10,
    };
    const elegida = elegirRegla([global5, item2], '100.0000', '1.0000');
    expect(elegida?.id).toBe('i2');
  });

  it('a igual prioridad gana mayor especificidad ITEM > CATEGORIA', () => {
    const cat: ReglaDescuentoCalculo = {
      id: 'cat',
      ambito: 'CATEGORIA',
      referenciaId: 'cat-1',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '5.0000',
      prioridad: 5,
    };
    const item: ReglaDescuentoCalculo = {
      id: 'item',
      ambito: 'ITEM',
      referenciaId: 'item-1',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '5.0000',
      prioridad: 5,
    };
    expect(elegirRegla([cat, item], '100.0000', '1.0000')?.id).toBe('item');
  });

  it('a igual especificidad gana mayor beneficio', () => {
    const a: ReglaDescuentoCalculo = {
      id: 'a',
      ambito: 'GLOBAL',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '5.0000',
      prioridad: 1,
    };
    const b: ReglaDescuentoCalculo = {
      id: 'b',
      ambito: 'GLOBAL',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '10.0000',
      prioridad: 1,
    };
    expect(elegirRegla([a, b], '100.0000', '1.0000')?.id).toBe('b');
  });
});

describe('calcularLinea', () => {
  it('sin precio marca revisión', () => {
    const r = calcularLinea(
      {
        itemId: 'i1',
        cantidad: '1.0000',
        precioLista: null,
      },
      [],
      '2026-09-18',
    );
    expect(r.requiereRevision).toBe(true);
    expect(r.precioUnitario).toBeNull();
  });

  it('cantidad mínima en el límite es elegible', () => {
    const regla: ReglaDescuentoCalculo = {
      id: 'min10',
      ambito: 'GLOBAL',
      cantidadMinima: '10.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '10.0000',
      prioridad: 1,
      estadoRegistro: 'ACTIVO',
    };
    const r = calcularLinea(
      { itemId: 'i1', cantidad: '10.0000', precioLista: '100.0000' },
      [regla],
      '2026-09-18',
    );
    expect(r.reglaDescuentoId).toBe('min10');
    expect(r.precioUnitario).toBe('90.0000');
  });

  it('regla vencida no aplica', () => {
    const regla: ReglaDescuentoCalculo = {
      id: 'vencida',
      ambito: 'GLOBAL',
      cantidadMinima: '1.0000',
      tipoDescuento: 'PORCENTAJE',
      valor: '10.0000',
      prioridad: 1,
      vigenciaHasta: '2026-01-01',
      estadoRegistro: 'ACTIVO',
    };
    const r = calcularLinea(
      { itemId: 'i1', cantidad: '1.0000', precioLista: '100.0000' },
      [regla],
      '2026-09-18',
    );
    expect(r.reglaDescuentoId).toBeNull();
    expect(r.precioUnitario).toBe('100.0000');
  });

  it('sobrescritura anula descuento de regla', () => {
    const r = calcularLinea(
      {
        itemId: 'i1',
        cantidad: '2.0000',
        precioLista: '100.0000',
        precioSobrescrito: '80.0000',
      },
      [reglaPct10],
      '2026-09-18',
    );
    expect(r.reglaDescuentoId).toBeNull();
    expect(r.precioUnitario).toBe('80.0000');
    expect(r.subtotal).toBe('160.0000');
  });
});

describe('calcularCotizacion — ejemplos numéricos de la spec', () => {
  const lineaComun = {
    itemId: 'item-demo',
    cantidad: '2.0000',
    precioLista: '100.0000' as string,
  };

  it('Ejemplo A — impuesto agregado', () => {
    const r = calcularCotizacion({
      lineas: [lineaComun],
      reglas: [reglaPct10],
      configuracion: { ...cfgBase, preciosIncluyenImpuesto: false },
      fechaReferencia: '2026-09-18',
      tasa: { valor: '36.500000' },
    });

    expect(r.lineas[0]?.precioLista).toBe('100.0000');
    expect(r.lineas[0]?.precioUnitario).toBe('90.0000');
    expect(r.lineas[0]?.descuentoMonto).toBe('20.0000');
    expect(r.lineas[0]?.subtotal).toBe('180.0000');
    expect(r.impuestoTotal).toBe('28.8000');
    expect(r.total).toBe('208.8000');
    expect(r.totalPresentacion).toBe('7621.2000');
  });

  it('Ejemplo B — impuesto incluido', () => {
    const r = calcularCotizacion({
      lineas: [lineaComun],
      reglas: [reglaPct10],
      configuracion: { ...cfgBase, preciosIncluyenImpuesto: true },
      fechaReferencia: '2026-09-18',
      tasa: { valor: '36.500000' },
    });

    expect(r.lineas[0]?.precioUnitario).toBe('90.0000');
    expect(r.lineas[0]?.descuentoMonto).toBe('20.0000');
    expect(r.baseImponible).toBe('155.1724');
    expect(r.impuestoTotal).toBe('24.8276');
    expect(r.total).toBe('180.0000');
    expect(r.totalPresentacion).toBe('6570.0000');
  });

  it('conversión solo del total (no suma de líneas convertidas)', () => {
    const r = calcularCotizacion({
      lineas: [
        { itemId: 'a', cantidad: '1.0000', precioLista: '100.0000' },
        { itemId: 'b', cantidad: '1.0000', precioLista: '50.0000' },
      ],
      reglas: [],
      configuracion: {
        aplicaImpuesto: false,
        porcentajeImpuesto: '0.0000',
        preciosIncluyenImpuesto: false,
        decimalesRedondeo: 2,
        modoRedondeo: 'NORMAL',
      },
      fechaReferencia: '2026-09-18',
      tasa: { valor: '36.500000' },
    });
    expect(r.total).toBe('150.0000');
    expect(r.totalPresentacion).toBe('5475.0000');
  });
});
