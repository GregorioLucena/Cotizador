import Decimal from 'decimal.js';

/** Precisión de importes (numeric 18,4). */
const SCALE_IMPORTE = 4;
/** Precisión de factor de tasa (numeric 18,6). */
const SCALE_TASA = 6;

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type AmbitoRegla = 'ITEM' | 'CATEGORIA' | 'MARCA' | 'GLOBAL';
export type TipoDescuento = 'PORCENTAJE' | 'MONTO_FIJO' | 'PRECIO_FIJO';
export type ModoRedondeo = 'NORMAL' | 'ARRIBA' | 'ABAJO';

export type ReglaDescuentoCalculo = {
  id: string;
  listaPrecioId?: string | null;
  ambito: AmbitoRegla;
  referenciaId?: string | null;
  cantidadMinima: string;
  cantidadMaxima?: string | null;
  tipoDescuento: TipoDescuento;
  valor: string;
  prioridad: number;
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  estadoRegistro?: 'ACTIVO' | 'INACTIVO';
  nombre?: string;
};

export type LineaCalculoEntrada = {
  id?: string;
  itemId: string;
  cantidad: string;
  /** null/undefined = sin precio en lista → requiere revisión */
  precioLista: string | null | undefined;
  categoriaId?: string | null;
  marcaId?: string | null;
  listaPrecioId?: string | null;
  /** Si existe, reemplaza precio unitario y anula descuento adicional */
  precioSobrescrito?: string | null;
};

export type ConfiguracionCalculo = {
  aplicaImpuesto: boolean;
  porcentajeImpuesto: string;
  preciosIncluyenImpuesto: boolean;
  decimalesRedondeo: number;
  modoRedondeo: ModoRedondeo;
};

export type TasaConversion = {
  valor: string;
};

export type EntradaCalculoCotizacion = {
  lineas: LineaCalculoEntrada[];
  /** Reglas de la org; el motor filtra vigencia, estado, lista y elegibilidad */
  reglas: ReglaDescuentoCalculo[];
  configuracion: ConfiguracionCalculo;
  /** ISO date YYYY-MM-DD; nunca se lee el reloj del sistema */
  fechaReferencia: string;
  tasa?: TasaConversion | null;
};

export type LineaCalculoResultado = {
  id?: string;
  itemId: string;
  cantidad: string;
  precioLista: string | null;
  precioUnitario: string | null;
  descuentoMonto: string;
  subtotal: string | null;
  reglaDescuentoId: string | null;
  requiereRevision: boolean;
};

export type ResultadoCalculoCotizacion = {
  lineas: LineaCalculoResultado[];
  subtotal: string;
  baseImponible: string;
  impuestoTotal: string;
  total: string;
  totalPresentacion: string | null;
};

const ESPECIFICIDAD: Record<AmbitoRegla, number> = {
  ITEM: 4,
  CATEGORIA: 3,
  MARCA: 2,
  GLOBAL: 1,
};

function d(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

/** Formatea a 4 decimales (importes). */
export function formatImporte(value: Decimal | string | number): string {
  return d(value).toFixed(SCALE_IMPORTE);
}

/** Formatea a 6 decimales (tasas). */
export function formatTasa(value: Decimal | string | number): string {
  return d(value).toFixed(SCALE_TASA);
}

function redondear(value: Decimal, decimales: number, modo: ModoRedondeo): Decimal {
  const mode =
    modo === 'ARRIBA'
      ? Decimal.ROUND_UP
      : modo === 'ABAJO'
        ? Decimal.ROUND_DOWN
        : Decimal.ROUND_HALF_UP;
  return value.toDecimalPlaces(decimales, mode);
}

/**
 * Aplica el descuento de una regla sobre el precio de lista.
 * No usa reloj ni BD.
 */
export function aplicarDescuento(
  precioLista: string,
  regla: Pick<ReglaDescuentoCalculo, 'tipoDescuento' | 'valor'>,
): string {
  const p = d(precioLista);
  const v = d(regla.valor);

  if (regla.tipoDescuento === 'PORCENTAJE') {
    const factor = d(1).minus(v.div(100));
    return formatImporte(p.times(factor));
  }
  if (regla.tipoDescuento === 'MONTO_FIJO') {
    const r = p.minus(v);
    return formatImporte(Decimal.max(r, 0));
  }
  // PRECIO_FIJO
  return formatImporte(v);
}

/**
 * Elige una sola regla entre candidatas ya elegibles.
 * Desempate: prioridad → especificidad → mayor beneficio → menor id.
 */
export function elegirRegla(
  candidatas: ReglaDescuentoCalculo[],
  precioLista: string,
  _cantidad: string,
): ReglaDescuentoCalculo | null {
  if (candidatas.length === 0) return null;

  const ranked = [...candidatas].sort((a, b) => {
    if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad;

    const espA = ESPECIFICIDAD[a.ambito];
    const espB = ESPECIFICIDAD[b.ambito];
    if (espB !== espA) return espB - espA;

    const precioA = d(aplicarDescuento(precioLista, a));
    const precioB = d(aplicarDescuento(precioLista, b));
    const cmpBeneficio = precioA.comparedTo(precioB);
    if (cmpBeneficio !== 0) return cmpBeneficio; // menor precio unitario gana

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return ranked[0] ?? null;
}

function enVigencia(
  regla: ReglaDescuentoCalculo,
  fechaReferencia: string,
): boolean {
  if (regla.vigenciaDesde && fechaReferencia < regla.vigenciaDesde) return false;
  if (regla.vigenciaHasta && fechaReferencia > regla.vigenciaHasta) return false;
  return true;
}

function cantidadEnRango(
  regla: ReglaDescuentoCalculo,
  cantidad: string,
): boolean {
  const q = d(cantidad);
  if (q.lessThan(d(regla.cantidadMinima))) return false;
  if (regla.cantidadMaxima != null && regla.cantidadMaxima !== '') {
    if (q.greaterThan(d(regla.cantidadMaxima))) return false;
  }
  return true;
}

function ambitoAplica(
  regla: ReglaDescuentoCalculo,
  linea: LineaCalculoEntrada,
): boolean {
  switch (regla.ambito) {
    case 'GLOBAL':
      return true;
    case 'ITEM':
      return regla.referenciaId === linea.itemId;
    case 'CATEGORIA':
      return (
        regla.referenciaId != null &&
        linea.categoriaId != null &&
        regla.referenciaId === linea.categoriaId
      );
    case 'MARCA':
      return (
        regla.referenciaId != null &&
        linea.marcaId != null &&
        regla.referenciaId === linea.marcaId
      );
    default:
      return false;
  }
}

/** Filtra reglas elegibles para una línea (sin reloj ni BD). */
export function filtrarReglasElegibles(
  reglas: ReglaDescuentoCalculo[],
  linea: LineaCalculoEntrada,
  fechaReferencia: string,
): ReglaDescuentoCalculo[] {
  return reglas.filter((r) => {
    if (r.estadoRegistro === 'INACTIVO') return false;
    if (!enVigencia(r, fechaReferencia)) return false;
    if (
      r.listaPrecioId != null &&
      linea.listaPrecioId != null &&
      r.listaPrecioId !== linea.listaPrecioId
    ) {
      return false;
    }
    if (!ambitoAplica(r, linea)) return false;
    if (!cantidadEnRango(r, linea.cantidad)) return false;
    return true;
  });
}

/**
 * Calcula una línea: base → descuento (o sobrescritura) → subtotal.
 * Impuesto y conversión se aplican a nivel documento.
 */
export function calcularLinea(
  linea: LineaCalculoEntrada,
  reglas: ReglaDescuentoCalculo[],
  fechaReferencia: string,
): LineaCalculoResultado {
  const base: LineaCalculoResultado = {
    id: linea.id,
    itemId: linea.itemId,
    cantidad: formatImporte(linea.cantidad),
    precioLista: null,
    precioUnitario: null,
    descuentoMonto: formatImporte(0),
    subtotal: null,
    reglaDescuentoId: null,
    requiereRevision: false,
  };

  if (linea.precioLista == null || linea.precioLista === '') {
    return { ...base, requiereRevision: true };
  }

  const precioLista = formatImporte(linea.precioLista);
  base.precioLista = precioLista;

  if (linea.precioSobrescrito != null && linea.precioSobrescrito !== '') {
    const unitario = formatImporte(linea.precioSobrescrito);
    const cantidad = d(linea.cantidad);
    const descuentoUnitario = d(precioLista).minus(d(unitario));
    const descuentoMonto = Decimal.max(descuentoUnitario.times(cantidad), 0);
    return {
      ...base,
      precioUnitario: unitario,
      descuentoMonto: formatImporte(descuentoMonto),
      subtotal: formatImporte(d(unitario).times(cantidad)),
      reglaDescuentoId: null,
    };
  }

  const candidatas = filtrarReglasElegibles(reglas, linea, fechaReferencia);
  const elegida = elegirRegla(candidatas, precioLista, linea.cantidad);

  let unitario = precioLista;
  let reglaId: string | null = null;
  if (elegida) {
    unitario = aplicarDescuento(precioLista, elegida);
    reglaId = elegida.id;
  }

  const cantidad = d(linea.cantidad);
  const descuentoUnitario = d(precioLista).minus(d(unitario));
  const descuentoMonto = descuentoUnitario.times(cantidad);

  return {
    ...base,
    precioUnitario: unitario,
    descuentoMonto: formatImporte(descuentoMonto),
    subtotal: formatImporte(d(unitario).times(cantidad)),
    reglaDescuentoId: reglaId,
  };
}

/**
 * Orden ADR: base → descuento → sobrescritura → impuesto → redondeo → conversión solo total.
 */
export function calcularTotalesCotizacion(
  entrada: EntradaCalculoCotizacion,
): ResultadoCalculoCotizacion {
  const lineas = entrada.lineas.map((l) =>
    calcularLinea(l, entrada.reglas, entrada.fechaReferencia),
  );

  const cfg = entrada.configuracion;
  let sumaSubtotales = d(0);
  for (const l of lineas) {
    if (l.subtotal != null) {
      sumaSubtotales = sumaSubtotales.plus(d(l.subtotal));
    }
  }

  let baseImponible = sumaSubtotales;
  let impuestoTotal = d(0);
  let total = sumaSubtotales;

  if (cfg.aplicaImpuesto) {
    const pct = d(cfg.porcentajeImpuesto);
    if (cfg.preciosIncluyenImpuesto) {
      const divisor = d(1).plus(pct.div(100));
      baseImponible = d(formatImporte(sumaSubtotales.div(divisor)));
      impuestoTotal = d(formatImporte(sumaSubtotales.minus(baseImponible)));
      total = sumaSubtotales;
    } else {
      baseImponible = sumaSubtotales;
      impuestoTotal = d(formatImporte(sumaSubtotales.times(pct.div(100))));
      total = sumaSubtotales.plus(impuestoTotal);
    }
  } else {
    impuestoTotal = d(0);
    baseImponible = sumaSubtotales;
    total = sumaSubtotales;
  }

  const totalRedondeado = redondear(
    total,
    cfg.decimalesRedondeo,
    cfg.modoRedondeo,
  );
  // Conservamos 4 decimales de almacenamiento tras el redondeo de presentación
  const totalStr = formatImporte(totalRedondeado);
  const subtotalStr = formatImporte(sumaSubtotales);
  const baseStr = formatImporte(baseImponible);
  const impuestoStr = formatImporte(impuestoTotal);

  let totalPresentacion: string | null = null;
  if (entrada.tasa?.valor) {
    const convertido = d(totalStr).times(d(entrada.tasa.valor));
    totalPresentacion = formatImporte(convertido);
  }

  return {
    lineas,
    subtotal: subtotalStr,
    baseImponible: baseStr,
    impuestoTotal: impuestoStr,
    total: totalStr,
    totalPresentacion,
  };
}

/** Alias ADR / spec CA. */
export function calcularCotizacion(
  entrada: EntradaCalculoCotizacion,
): ResultadoCalculoCotizacion {
  return calcularTotalesCotizacion(entrada);
}
