import Decimal from 'decimal.js';
import type { ModoRedondeo } from './motor';

/** Entero 0–4. Fuera de rango o no finito cae en 2, el valor inicial de la organización. */
export function acotarDecimalesRedondeo(decimales: number): number {
  if (!Number.isFinite(decimales)) return 2;
  return Math.max(0, Math.min(4, Math.trunc(decimales)));
}

export function modoRedondeoDe(valor: string | null | undefined): ModoRedondeo {
  if (valor === 'ARRIBA' || valor === 'ABAJO' || valor === 'NORMAL') return valor;
  return 'NORMAL';
}

function rounding(modo: ModoRedondeo): Decimal.Rounding {
  if (modo === 'ARRIBA') return Decimal.ROUND_UP;
  if (modo === 'ABAJO') return Decimal.ROUND_DOWN;
  return Decimal.ROUND_HALF_UP;
}

/**
 * Presenta un importe con los decimales y el modo de redondeo de la organización.
 * No cambia el valor guardado: la API sigue en 4 decimales.
 */
export function formatearImportePresentacion(
  valor: string | number | null | undefined,
  decimales: number,
  opciones?: { locale?: string; modo?: ModoRedondeo },
): string {
  if (valor == null || valor === '') return '—';
  let dec: Decimal;
  try {
    dec = new Decimal(valor);
  } catch {
    return String(valor);
  }
  if (!dec.isFinite()) return String(valor);

  const escala = acotarDecimalesRedondeo(decimales);
  const redondeado = dec.toDecimalPlaces(
    escala,
    rounding(opciones?.modo ?? 'NORMAL'),
  );
  const fijo = redondeado.toFixed(escala);
  const locale = opciones?.locale?.trim() || 'es-VE';
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: escala,
      maximumFractionDigits: escala,
    }).format(Number(fijo));
  } catch {
    return fijo;
  }
}

/** Cantidad visible sin ceros de relleno. No usa los decimales de importe. */
export function formatearCantidadPresentacion(
  valor: string | number | null | undefined,
): string {
  if (valor == null || valor === '') return '';
  try {
    const dec = new Decimal(valor);
    if (!dec.isFinite()) return String(valor);
    const fijo = dec.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
    return fijo.replace(/\.?0+$/, '') || '0';
  } catch {
    return String(valor);
  }
}
