import type { LineaExtraida, ResultadoExtraccion } from '../schemas/precotizacion.schemas';
import {
  LIMITE_LINEAS_EXTRACCION,
  VERSION_PROMPT_EXTRACCION,
  resultadoExtraccionSchema,
} from '../schemas/precotizacion.schemas';

export type EntradaExtraccion = {
  textoNormalizado: string;
  unidadesValidas: string[];
  limiteLineas: number;
};

export interface ProveedorIa {
  readonly nombre: string;
  readonly modelo: string;
  readonly versionPrompt: string;
  extraerLineas(entrada: EntradaExtraccion): Promise<ResultadoExtraccion>;
}

/**
 * Mock determinista: parsea líneas tipo "2x tornillo 1/4" o una necesidad por renglón.
 * Nunca inventa precios ni ids de catálogo.
 */
export class ProveedorIaMock implements ProveedorIa {
  readonly nombre = 'mock';
  readonly modelo = 'mock';
  readonly versionPrompt = VERSION_PROMPT_EXTRACCION;

  async extraerLineas(entrada: EntradaExtraccion): Promise<ResultadoExtraccion> {
    const inicio = Date.now();
    const limite = Math.min(
      entrada.limiteLineas || LIMITE_LINEAS_EXTRACCION,
      LIMITE_LINEAS_EXTRACCION,
    );
    const unidadesSet = new Set(
      entrada.unidadesValidas.map((u) => u.toUpperCase()),
    );

    const lineasRaw = entrada.textoNormalizado
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const lineas: LineaExtraida[] = [];
    const advertencias: string[] = [];

    for (const raw of lineasRaw) {
      if (lineas.length >= limite) {
        advertencias.push('LIMITE_LINEAS_ALCANZADO');
        break;
      }
      const parseada = parsearLineaHeuristica(raw, unidadesSet);
      if (parseada) lineas.push(parseada);
    }

    // También intenta separar por comas si solo hay un bloque
    if (lineas.length === 0 && entrada.textoNormalizado.includes(',')) {
      for (const parte of entrada.textoNormalizado.split(',')) {
        if (lineas.length >= limite) break;
        const parseada = parsearLineaHeuristica(parte.trim(), unidadesSet);
        if (parseada) lineas.push(parseada);
      }
    }

    if (lineas.length === 0 && entrada.textoNormalizado.trim()) {
      // Un bloque sin cantidad explícita → cantidad 1
      lineas.push({
        textoSolicitado: entrada.textoNormalizado.trim().slice(0, 500),
        cantidad: '1.0000',
        notas: 'cantidad asumida en 1',
      });
    }

    const resultado = {
      lineas,
      advertencias: lineas.length === 0 ? ['IA_SIN_LINEAS'] : advertencias,
      metricas: {
        latenciaMs: Math.max(0, Date.now() - inicio),
        tokensEntrada: Math.ceil(entrada.textoNormalizado.length / 4),
        tokensSalida: lineas.length * 12,
        costoEstimado: 0,
      },
    };

    return resultadoExtraccionSchema.parse(resultado);
  }
}

/**
 * Patrones: "2x tornillo", "2 tubos de 1/2", "10 und codos", "5m manguera"
 */
function parsearLineaHeuristica(
  texto: string,
  unidadesValidas: Set<string>,
): LineaExtraida | null {
  const t = texto.trim();
  if (!t) return null;

  // 2x / 2 x / 2*
  const mX = t.match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s+(.+)$/i);
  if (mX) {
    return {
      textoSolicitado: mX[2].trim().slice(0, 500),
      cantidad: formatCantidad(mX[1]),
    };
  }

  // 5m / 10und / 2 pcs al inicio
  const mUnidadPrefijo = t.match(
    /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z"]{1,10})\s+(.+)$/,
  );
  if (mUnidadPrefijo) {
    const codigo = mUnidadPrefijo[2].toUpperCase();
    const resto = mUnidadPrefijo[3].trim();
    if (unidadesValidas.has(codigo) || /^[a-zA-Z]{1,4}$/.test(codigo)) {
      const linea: LineaExtraida = {
        textoSolicitado: resto.slice(0, 500),
        cantidad: formatCantidad(mUnidadPrefijo[1]),
      };
      if (unidadesValidas.has(codigo)) {
        linea.unidad = codigo;
      } else if (!/^(de|del|la|el|un|una)$/i.test(codigo)) {
        // Unidad no validada: se deja en el texto solicitado (pregunta abierta en spec)
        linea.textoSolicitado = `${mUnidadPrefijo[2]} ${resto}`.slice(0, 500);
      }
      return linea;
    }
  }

  // N al inicio seguido de descripción: "2 tubos de media"
  const mNum = t.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (mNum) {
    return {
      textoSolicitado: mNum[2].trim().slice(0, 500),
      cantidad: formatCantidad(mNum[1]),
    };
  }

  // Sin cantidad
  return {
    textoSolicitado: t.slice(0, 500),
    cantidad: '1.0000',
    notas: 'cantidad asumida en 1',
  };
}

function formatCantidad(raw: string): string {
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return '1.0000';
  return n.toFixed(4);
}

/** Proveedor nulo: no llama a ningún servicio; cero líneas. */
export class ProveedorIaNone implements ProveedorIa {
  readonly nombre = 'none';
  readonly modelo = 'none';
  readonly versionPrompt = VERSION_PROMPT_EXTRACCION;

  async extraerLineas(_entrada: EntradaExtraccion): Promise<ResultadoExtraccion> {
    return resultadoExtraccionSchema.parse({
      lineas: [],
      advertencias: ['IA_DESACTIVADA'],
      metricas: { latenciaMs: 0 },
    });
  }
}

export const PROVEEDOR_IA_TOKEN = 'PROVEEDOR_IA';
