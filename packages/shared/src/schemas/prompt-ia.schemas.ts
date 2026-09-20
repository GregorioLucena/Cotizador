import { z } from 'zod';
import { lineaExtraidaSchema } from './precotizacion.schemas';

export const PROPOSITO_PROMPT_EXTRACCION = 'EXTRACCION_LINEAS' as const;
export const CONTRATO_EXTRACCION_VERSION = 'contrato-extraccion.v1' as const;
/** Fallback cuando la vertical de la org no tiene política ACTIVA. */
export const VERTICAL_PROMPT_FALLBACK = 'GENERICO' as const;

export const verticalCodigoPromptSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Use un código de vertical en MAYÚSCULAS');

export type VerticalCodigoPrompt = z.infer<typeof verticalCodigoPromptSchema>;

export const estadoPromptVersionSchema = z.enum([
  'BORRADOR',
  'PUBLICADA',
  'ACTIVA',
  'ARCHIVADA',
]);

export type EstadoPromptVersion = z.infer<typeof estadoPromptVersionSchema>;

export const fewShotExtraccionSchema = z
  .object({
    entrada: z.string().trim().min(1).max(2000),
    lineas: z.array(lineaExtraidaSchema).min(1).max(20),
  })
  .strict();

export type FewShotExtraccion = z.infer<typeof fewShotExtraccionSchema>;

export const politicaExtraccionSchema = z
  .object({
    blacklist: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
    reglasCantidad: z.string().trim().max(2000).default(''),
    fewShots: z.array(fewShotExtraccionSchema).max(20).default([]),
    instruccionesExtra: z.string().trim().max(4000).default(''),
  })
  .strict();

export type PoliticaExtraccion = z.infer<typeof politicaExtraccionSchema>;

export const POLITICA_EXTRACCION_DEFAULT: PoliticaExtraccion = {
  blacklist: [
    'necesito',
    'necesito que',
    'hola',
    'buenas',
    'buen dia',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'porfa',
    'por favor',
    'gracias',
    'saludos',
    'ok',
    'dale',
  ],
  reglasCantidad:
    'Si el cliente no indica cantidad, usa 1.0000 y anota en notas "cantidad asumida en 1". ' +
    'No inventes cantidades distintas de 1 sin base en el texto. ' +
    'No trates saludos, verbos sueltos ni palabras de cortesía como líneas de pedido.',
  fewShots: [
    {
      entrada: '2 tubos de 1/2, 10 codos y un pegamento azul',
      lineas: [
        {
          textoSolicitado: 'tubos de 1/2',
          cantidad: '2.0000',
        },
        {
          textoSolicitado: 'codos',
          cantidad: '10.0000',
        },
        {
          textoSolicitado: 'pegamento azul',
          cantidad: '1.0000',
          notas: 'cantidad asumida en 1',
        },
      ],
    },
  ],
  instruccionesExtra:
    'Extrae solo ítems de pedido del mensaje de WhatsApp. Ignora metadatos de chat, ' +
    'reenvíos y frases que no pidan mercancía.',
};

export const crearPromptVersionSchema = z
  .object({
    verticalCodigo: verticalCodigoPromptSchema,
    codigo: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(
        /^extraccion-lineas(\.[A-Z][A-Z0-9_]*)?\.v\d+$/,
        'Use el formato extraccion-lineas.VERTICAL.vN',
      ),
    politica: politicaExtraccionSchema,
    notasCambio: z.string().trim().max(1000).optional(),
  })
  .strict();

export type CrearPromptVersionInput = z.infer<typeof crearPromptVersionSchema>;

export const editarPromptVersionSchema = z
  .object({
    politica: politicaExtraccionSchema.optional(),
    notasCambio: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => v.politica != null || v.notasCambio != null, {
    message: 'Indique politica o notasCambio',
  });

export type EditarPromptVersionInput = z.infer<typeof editarPromptVersionSchema>;

export const evaluarPromptSchema = z
  .object({
    limiteMuestras: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export type EvaluarPromptInput = z.infer<typeof evaluarPromptSchema>;

export const resultadoEvaluacionPromptSchema = z
  .object({
    muestras: z.number().int().min(0),
    jsonValido: z.number().int().min(0),
    salidaInvalida: z.number().int().min(0),
    ceroLineas: z.number().int().min(0),
    erroresProveedor: z.number().int().min(0),
    latenciaMsP50: z.number().int().min(0).nullable(),
    evaluadoAt: z.string().datetime(),
  })
  .strict();

export type ResultadoEvaluacionPrompt = z.infer<
  typeof resultadoEvaluacionPromptSchema
>;

/**
 * Texto inmutable del contrato (capa 1). No se edita en UI.
 */
export const TEXTO_CONTRATO_EXTRACCION_V1 = `Eres un extractor de líneas de pedido para cotizaciones.
Devuelves ÚNICAMENTE JSON que cumpla el schema. Prohibido incluir: precios, totales, descuentos,
monedas, SKU, ids de catálogo, nombres de listas o sugerencias de productos del inventario.
Campos permitidos por línea: textoSolicitado, cantidad (decimal string > 0 con hasta 4 decimales),
unidad (opcional, código de la lista de unidades válidas), notas (opcional).
Si no hay ítems de pedido, devuelve lineas: [].`;

/**
 * JSON Schema estricto compatible con OpenAI Structured Outputs.
 * Alineado a resultadoExtraccionSchema / lineaExtraidaSchema (sin metricas en la respuesta del modelo).
 */
export const OPENAI_EXTRACCION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lineas', 'advertencias'],
  properties: {
    lineas: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['textoSolicitado', 'cantidad', 'unidad', 'notas'],
        properties: {
          textoSolicitado: { type: 'string', minLength: 1, maxLength: 500 },
          cantidad: {
            type: 'string',
            description:
              'Decimal mayor que cero como cadena con hasta 4 decimales, p.ej. 2.0000',
          },
          unidad: {
            anyOf: [
              { type: 'string', minLength: 1, maxLength: 20 },
              { type: 'null' },
            ],
          },
          notas: {
            anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }],
          },
        },
      },
    },
    advertencias: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;
