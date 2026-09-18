/**
 * Normalización de códigos y textos de búsqueda para maestras/catálogo.
 */

export function quitarAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Código de unidad: mayúsculas, sin acentos ni espacios. */
export function normalizarCodigoUnidad(valor: string): string {
  return quitarAcentos(valor).replace(/\s+/g, '').toUpperCase();
}

/** Código de definición: minúsculas, sin acentos ni espacios. */
export function normalizarCodigoDefinicion(valor: string): string {
  return quitarAcentos(valor).replace(/\s+/g, '').toLowerCase();
}

/** Comparación de nombres sin distinguir mayúsculas/acentos. */
export function normalizarNombreComparacion(valor: string): string {
  return quitarAcentos(valor).trim().toLowerCase();
}

/** Fragmento para textoBusqueda: minúsculas, sin acentos, espacios colapsados. */
export function normalizarTextoBusqueda(...partes: Array<string | null | undefined>): string {
  return partes
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => quitarAcentos(p).toLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}
