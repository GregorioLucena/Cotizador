/**
 * Formatea el folio textual a partir del número y la config de plantilla.
 * Default: prefijo COT- y 4 dígitos (ADR 0006).
 */
export function formatearFolio(
  folioNumero: number,
  opciones?: { prefijo?: string; longitudNumero?: number },
): string {
  const prefijo = opciones?.prefijo ?? 'COT-';
  const longitud = opciones?.longitudNumero ?? 4;
  const num = String(folioNumero).padStart(longitud, '0');
  return `${prefijo}${num}`;
}
