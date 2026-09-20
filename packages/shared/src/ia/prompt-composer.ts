import type { PoliticaExtraccion } from '../schemas/prompt-ia.schemas';
import {
  CONTRATO_EXTRACCION_VERSION,
  TEXTO_CONTRATO_EXTRACCION_V1,
} from '../schemas/prompt-ia.schemas';
import type { EntradaExtraccion } from './proveedor';

export type MensajePrompt = {
  role: 'system' | 'user';
  content: string;
};

export type PromptCompuesto = {
  mensajes: MensajePrompt[];
  versionPrompt: string;
  contratoVersion: string;
};

/**
 * Compone system+user a partir de contrato (inmutable), política (BD) y contexto (request).
 */
export function componerPromptExtraccion(opts: {
  politica: PoliticaExtraccion;
  codigoVersion: string;
  entrada: EntradaExtraccion;
  nombreVertical?: string | null;
}): PromptCompuesto {
  const { politica, codigoVersion, entrada, nombreVertical } = opts;

  const fewShots =
    politica.fewShots.length === 0
      ? ''
      : [
          'Ejemplos:',
          ...politica.fewShots.map((fs, i) => {
            const salida = JSON.stringify({ lineas: fs.lineas, advertencias: [] });
            return `${i + 1}. Entrada: ${fs.entrada}\n   Salida: ${salida}`;
          }),
        ].join('\n');

  const blacklist =
    politica.blacklist.length === 0
      ? ''
      : `No emitas líneas cuyo textoSolicitado sea solo ruido o coincida (sin importar mayúsculas) con: ${politica.blacklist.join(', ')}.`;

  const system = [
    TEXTO_CONTRATO_EXTRACCION_V1,
    '',
    `Contrato: ${CONTRATO_EXTRACCION_VERSION}. Política: ${codigoVersion}.`,
    politica.reglasCantidad ? `Reglas de cantidad: ${politica.reglasCantidad}` : '',
    blacklist,
    politica.instruccionesExtra ? `Instrucciones: ${politica.instruccionesExtra}` : '',
    fewShots,
    `Límite de líneas: ${entrada.limiteLineas}.`,
    `Unidades válidas (códigos): ${entrada.unidadesValidas.length ? entrada.unidadesValidas.join(', ') : '(ninguna configurada)'}.`,
    nombreVertical ? `Vertical de la organización: ${nombreVertical}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    'Extrae las líneas de pedido del siguiente texto normalizado de WhatsApp:',
    '',
    entrada.textoNormalizado,
  ].join('\n');

  return {
    mensajes: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    versionPrompt: codigoVersion,
    contratoVersion: CONTRATO_EXTRACCION_VERSION,
  };
}
