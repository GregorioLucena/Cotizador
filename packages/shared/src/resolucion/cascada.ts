/**
 * Clasificación de resolución de líneas contra el catálogo (cascada ADR 0007).
 * Pura: sin BD ni reloj. El servicio de API ejecuta las consultas y llama aquí.
 */

export type OrigenMatchResolucion =
  | 'SKU'
  | 'ALIAS_EXACTO'
  | 'ALIAS_SIMILITUD'
  | 'TEXTO_SIMILITUD'
  | 'ATRIBUTO'
  | 'MANUAL';

export type EstadoResolucion =
  | 'RESUELTA_AUTOMATICA'
  | 'SUGERIDA_REVISAR'
  | 'NO_ENCONTRADA';

export type CandidatoResolucion = {
  itemId: string;
  nombre: string;
  sku?: string | null;
  puntaje: number;
  origenMatch: OrigenMatchResolucion;
  aliasId?: string | null;
};

export type UmbralesResolucion = {
  umbralAutomatico: number;
  umbralDescarte: number;
};

export const UMBRALES_RESOLUCION_DEFAULT: UmbralesResolucion = {
  umbralAutomatico: 0.8,
  umbralDescarte: 0.45,
};

export const DIFERENCIA_EMPATE = 0.05;
export const MAX_CANDIDATOS_LINEA = 5;

/** Puntajes base / rangos por estrategia (ADR 0007). */
export const PUNTAJE_SKU = 1.0;
export const PUNTAJE_ALIAS_EXACTO = 0.98;

export function mapearSimilitudAlias(similitud: number): number {
  // similarity 0..1 → 0.60..0.95
  const s = clamp01(similitud);
  return 0.6 + s * 0.35;
}

export function mapearSimilitudTexto(similitud: number): number {
  // 0.50..0.90
  const s = clamp01(similitud);
  return 0.5 + s * 0.4;
}

export function mapearSimilitudAtributo(similitud: number): number {
  // 0.45..0.85
  const s = clamp01(similitud);
  return 0.45 + s * 0.4;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Ordena candidatos por puntaje desc y nombre asc; deduplica por itemId
 * (conserva el de mayor puntaje / mejor origen).
 */
export function consolidarCandidatos(
  candidatos: CandidatoResolucion[],
  max = MAX_CANDIDATOS_LINEA,
): CandidatoResolucion[] {
  const porItem = new Map<string, CandidatoResolucion>();
  for (const c of candidatos) {
    const prev = porItem.get(c.itemId);
    if (!prev || c.puntaje > prev.puntaje) {
      porItem.set(c.itemId, c);
    }
  }
  return [...porItem.values()]
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      return a.nombre.localeCompare(b.nombre, 'es');
    })
    .slice(0, max);
}

export type ResultadoResolucionLinea = {
  estadoResolucion: EstadoResolucion;
  confianza: number;
  origenMatch: OrigenMatchResolucion | null;
  itemId: string | null;
  candidatos: CandidatoResolucion[];
  /** Alias a incrementar vecesUsado si la resolución usó alias. */
  aliasIdUsado: string | null;
};

/**
 * Aplica umbrales y regla de empate (&lt; 0.05 → no automática).
 */
export function clasificarResolucion(
  candidatos: CandidatoResolucion[],
  umbrales: UmbralesResolucion = UMBRALES_RESOLUCION_DEFAULT,
): ResultadoResolucionLinea {
  const top = consolidarCandidatos(candidatos);
  if (top.length === 0) {
    return {
      estadoResolucion: 'NO_ENCONTRADA',
      confianza: 0,
      origenMatch: null,
      itemId: null,
      candidatos: [],
      aliasIdUsado: null,
    };
  }

  const mejor = top[0];
  const segundo = top[1];
  const empate =
    segundo != null &&
    Math.abs(mejor.puntaje - segundo.puntaje) < DIFERENCIA_EMPATE;

  let estado: EstadoResolucion;
  if (mejor.puntaje < umbrales.umbralDescarte) {
    estado = 'NO_ENCONTRADA';
  } else if (mejor.puntaje >= umbrales.umbralAutomatico && !empate) {
    estado = 'RESUELTA_AUTOMATICA';
  } else {
    estado = 'SUGERIDA_REVISAR';
  }

  const resuelta =
    estado === 'RESUELTA_AUTOMATICA' || estado === 'SUGERIDA_REVISAR';

  const aliasIdUsado =
    resuelta &&
    (mejor.origenMatch === 'ALIAS_EXACTO' ||
      mejor.origenMatch === 'ALIAS_SIMILITUD')
      ? (mejor.aliasId ?? null)
      : null;

  return {
    estadoResolucion: estado,
    confianza: Number(mejor.puntaje.toFixed(4)),
    origenMatch: resuelta ? mejor.origenMatch : mejor.origenMatch,
    itemId: estado === 'NO_ENCONTRADA' ? null : mejor.itemId,
    candidatos: top,
    aliasIdUsado,
  };
}

export function formatConfianza(n: number): string {
  return n.toFixed(4);
}
