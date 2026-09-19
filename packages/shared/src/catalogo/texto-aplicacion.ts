import { aplicacionDatosInvalidos, aplicacionRangoExcesivo } from '../errors/item.errors';
import { normalizarTexto } from '../normalizacion/texto';

export const LIMITE_CLAVES_APLICACION = 20;
export const LIMITE_RANGO_ANIOS_APLICACION = 60;

/**
 * Construye el texto normalizado de una aplicación.
 * Expande `anioDesde`/`anioHasta` a años individuales (máx. 60).
 */
export function construirTextoAplicacion(
  datos: Record<string, unknown>,
): string {
  if (
    typeof datos !== 'object' ||
    datos === null ||
    Array.isArray(datos)
  ) {
    throw aplicacionDatosInvalidos({ motivo: 'no_plano' });
  }

  const entradas = Object.entries(datos).filter(([, v]) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    return true;
  });

  if (entradas.length === 0) {
    throw aplicacionDatosInvalidos({ motivo: 'vacio' });
  }
  if (entradas.length > LIMITE_CLAVES_APLICACION) {
    throw aplicacionDatosInvalidos({ motivo: 'demasiadas_claves' });
  }

  const mapa = Object.fromEntries(entradas);
  const anioDesde = mapa.anioDesde;
  const anioHasta = mapa.anioHasta;
  const partes: string[] = [];

  for (const [clave, valor] of entradas) {
    if (clave === 'anioDesde' || clave === 'anioHasta') continue;
    partes.push(String(valor));
  }

  if (anioDesde !== undefined || anioHasta !== undefined) {
    const desde =
      typeof anioDesde === 'number'
        ? anioDesde
        : typeof anioDesde === 'string'
          ? Number(anioDesde)
          : NaN;
    const hasta =
      typeof anioHasta === 'number'
        ? anioHasta
        : typeof anioHasta === 'string'
          ? Number(anioHasta)
          : NaN;

    if (
      !Number.isInteger(desde) ||
      !Number.isInteger(hasta) ||
      desde > hasta
    ) {
      throw aplicacionDatosInvalidos({ motivo: 'rango_invalido' });
    }

    const span = hasta - desde + 1;
    if (span > LIMITE_RANGO_ANIOS_APLICACION) {
      throw aplicacionRangoExcesivo();
    }

    for (let y = desde; y <= hasta; y++) {
      partes.push(String(y));
    }
  }

  return normalizarTexto(partes.join(' '));
}
