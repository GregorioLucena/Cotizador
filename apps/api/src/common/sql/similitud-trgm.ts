/**
 * Puntaje pg_trgm para búsqueda / resolución de catálogo.
 *
 * `similarity(a,b)` compara el conjunto de trigramas completo: una consulta corta
 * contra un texto largo (p. ej. «tiza» vs «tiza para herrero blanca…») cae ~0.10
 * y queda bajo el umbral 0.30 aunque la palabra esté en el nombre.
 *
 * `word_similarity(consulta, texto)` mide si la consulta se parece a alguna
 * palabra/frase del texto (en ese caso ≈ 1.0).
 *
 * El nombre se incluye por si `textoBusqueda` quedó vacío tras una importación.
 */
export function sqlSimTrgm(columna: string): string {
  return `GREATEST(similarity(${columna}, :qNorm), word_similarity(:qNorm, ${columna}))`;
}

/** Similitud sobre texto indexado + nombre (items). */
export function sqlSimTrgmItem(
  aliasItem = 'i',
  columnaTexto = `${aliasItem}.textoBusqueda`,
): string {
  const nombreNorm = `lower(unaccent(coalesce(${aliasItem}.nombre, '')))`;
  return `GREATEST(similarity(${columnaTexto}, :qNorm), word_similarity(:qNorm, ${columnaTexto}), word_similarity(:qNorm, ${nombreNorm}))`;
}
