import { itemAtributosErroresAcumulados, itemAtributosLimiteExcedido } from '../errors/item.errors';

export const LIMITE_ATRIBUTOS_POR_ITEM = 40;

export type TipoDatoAtributo =
  | 'TEXTO'
  | 'NUMERO'
  | 'ENTERO'
  | 'BOOLEANO'
  | 'LISTA'
  | 'RANGO_ANIO';

export type DefinicionAtributoValidacion = {
  codigo: string;
  tipoDato: TipoDatoAtributo;
  opciones?: string[] | null;
  requerido: boolean;
};

export type ErrorAtributo = {
  code: string;
  message: string;
  clave: string;
  details?: Record<string, unknown>;
};

function esVacio(valor: unknown): boolean {
  return (
    valor === null ||
    valor === undefined ||
    (typeof valor === 'string' && valor.trim() === '')
  );
}

function normalizarNumeroComoCadena(valor: number | string): string {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return String(valor);
  const fijo = n.toFixed(4);
  return fijo.replace(/\.?0+$/, '') || '0';
}

function validarValor(
  clave: string,
  valor: unknown,
  def: DefinicionAtributoValidacion,
): { ok: true; valor: unknown } | { ok: false; error: ErrorAtributo } {
  switch (def.tipoDato) {
    case 'TEXTO': {
      if (typeof valor !== 'string') {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'TEXTO', valorRecibido: valor },
          },
        };
      }
      const texto = valor.trim();
      if (texto.length < 1 || texto.length > 200) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'TEXTO', valorRecibido: valor },
          },
        };
      }
      return { ok: true, valor: texto };
    }
    case 'NUMERO': {
      const n =
        typeof valor === 'number'
          ? valor
          : typeof valor === 'string'
            ? Number(valor.trim())
            : NaN;
      if (!Number.isFinite(n)) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'NUMERO', valorRecibido: valor },
          },
        };
      }
      return { ok: true, valor: normalizarNumeroComoCadena(n) };
    }
    case 'ENTERO': {
      if (typeof valor === 'string' && !/^-?\d+$/.test(valor.trim())) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'ENTERO', valorRecibido: valor },
          },
        };
      }
      const n =
        typeof valor === 'number'
          ? valor
          : typeof valor === 'string'
            ? Number(valor.trim())
            : NaN;
      if (!Number.isInteger(n)) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'ENTERO', valorRecibido: valor },
          },
        };
      }
      return { ok: true, valor: String(n) };
    }
    case 'BOOLEANO': {
      if (typeof valor !== 'boolean') {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'BOOLEANO', valorRecibido: valor },
          },
        };
      }
      return { ok: true, valor };
    }
    case 'LISTA': {
      if (typeof valor !== 'string') {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
            message: 'El valor del atributo no corresponde al tipo definido.',
            clave,
            details: { tipoEsperado: 'LISTA', valorRecibido: valor },
          },
        };
      }
      const opciones = def.opciones ?? [];
      if (!opciones.includes(valor)) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_OPCION_INVALIDA',
            message: 'El valor no está entre las opciones permitidas.',
            clave,
            details: { opciones },
          },
        };
      }
      return { ok: true, valor };
    }
    case 'RANGO_ANIO': {
      if (
        typeof valor !== 'object' ||
        valor === null ||
        Array.isArray(valor) ||
        !('desde' in valor) ||
        !('hasta' in valor)
      ) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_RANGO_INVALIDO',
            message: 'El rango de años del atributo no es válido.',
            clave,
            details: { valorRecibido: valor },
          },
        };
      }
      const desde = (valor as { desde: unknown }).desde;
      const hasta = (valor as { hasta: unknown }).hasta;
      if (
        typeof desde !== 'number' ||
        typeof hasta !== 'number' ||
        !Number.isInteger(desde) ||
        !Number.isInteger(hasta) ||
        desde < 1900 ||
        desde > 2100 ||
        hasta < 1900 ||
        hasta > 2100 ||
        desde > hasta
      ) {
        return {
          ok: false,
          error: {
            code: 'ITEM_ATRIBUTO_RANGO_INVALIDO',
            message: 'El rango de años del atributo no es válido.',
            clave,
            details: { valorRecibido: valor },
          },
        };
      }
      return { ok: true, valor: { desde, hasta } };
    }
    default:
      return {
        ok: false,
        error: {
          code: 'ITEM_ATRIBUTO_TIPO_INVALIDO',
          message: 'El valor del atributo no corresponde al tipo definido.',
          clave,
        },
      };
  }
}

/**
 * Valida `atributos` contra definiciones activas.
 * Acumula todos los errores; elimina claves null/''.
 * Lanza AppError 400 con `details.errores` o BusinessRuleError por límite.
 */
export function validarAtributos(
  atributos: Record<string, unknown> | null | undefined,
  definiciones: DefinicionAtributoValidacion[],
  opciones?: { conservarInactivas?: Record<string, unknown> },
): Record<string, unknown> {
  const entrada = { ...(atributos ?? {}) };
  const defPorCodigo = new Map(definiciones.map((d) => [d.codigo, d]));
  const errores: ErrorAtributo[] = [];
  const resultado: Record<string, unknown> = {
    ...(opciones?.conservarInactivas ?? {}),
  };

  // Eliminar null / '' de la entrada
  for (const [clave, valor] of Object.entries(entrada)) {
    if (esVacio(valor)) {
      delete entrada[clave];
      delete resultado[clave];
    }
  }

  const clavesEntrada = Object.keys(entrada);
  if (clavesEntrada.length > LIMITE_ATRIBUTOS_POR_ITEM) {
    throw itemAtributosLimiteExcedido();
  }

  for (const clave of clavesEntrada) {
    const def = defPorCodigo.get(clave);
    if (!def) {
      // Conservar valor de definición inactiva si ya existía
      if (opciones?.conservarInactivas && clave in opciones.conservarInactivas) {
        if (!esVacio(entrada[clave])) {
          resultado[clave] = entrada[clave];
        }
        continue;
      }
      errores.push({
        code: 'ITEM_ATRIBUTO_DESCONOCIDO',
        message: 'Hay un atributo que no está definido en la organización.',
        clave,
      });
      continue;
    }

    const validado = validarValor(clave, entrada[clave], def);
    if (!validado.ok) {
      errores.push(validado.error);
    } else {
      resultado[clave] = validado.valor;
    }
  }

  for (const def of definiciones) {
    if (!def.requerido) continue;
    if (esVacio(resultado[def.codigo])) {
      errores.push({
        code: 'ITEM_ATRIBUTO_REQUERIDO_AUSENTE',
        message: 'Falta un atributo obligatorio.',
        clave: def.codigo,
      });
    }
  }

  const clavesFinales = Object.keys(resultado).filter(
    (k) => !esVacio(resultado[k]),
  );
  if (clavesFinales.length > LIMITE_ATRIBUTOS_POR_ITEM) {
    throw itemAtributosLimiteExcedido();
  }

  if (errores.length > 0) {
    throw itemAtributosErroresAcumulados(errores);
  }

  const limpio: Record<string, unknown> = {};
  for (const k of clavesFinales) {
    limpio[k] = resultado[k];
  }
  return limpio;
}
