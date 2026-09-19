/**
 * Normalización de texto para indexado y búsqueda del catálogo.
 * Misma función en escritura (textoBusqueda) y consulta (buscar).
 */

const EQUIVALENCIAS_MEDIDA: Array<[RegExp, string]> = [
  [/\bmedia\b/g, '1/2'],
  [/\bmedio\b/g, '1/2'],
  [/\b0[,.]5\b/g, '1/2'],
  [/\b3\/4\b/g, '3/4'],
  [/\b0[,.]75\b/g, '3/4'],
  [/\b1\/4\b/g, '1/4'],
  [/\b0[,.]25\b/g, '1/4'],
  [/\b1\/8\b/g, '1/8'],
  [/\bpulgadas?\b/g, '"'],
  [/\bpulg\.?\b/g, '"'],
];

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

/**
 * Normalización canónica de consulta e indexado (spec 004).
 * Preserva `/` y `.` en medidas; elimina el resto de puntuación.
 */
export function normalizarTexto(valor: string): string {
  let t = valor.trim().toLowerCase();
  t = quitarAcentos(t);
  t = t.replace(/[^\p{L}\p{N}\s/.]/gu, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  for (const [re, rep] of EQUIVALENCIAS_MEDIDA) {
    t = t.replace(re, rep);
  }
  return t.replace(/\s+/g, ' ').trim();
}

/** Concatena partes y aplica normalizarTexto (textoBusqueda). */
export function normalizarTextoBusqueda(...partes: Array<string | null | undefined>): string {
  const unidos = partes
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .map((p) => String(p).trim())
    .join(' ');
  return normalizarTexto(unidos);
}
