import type {
  EntradaExtraccion,
  ProveedorIa,
  ResultadoExtraccion,
} from '@cotizador/shared';
import {
  OPENAI_EXTRACCION_JSON_SCHEMA,
  VERSION_PROMPT_EXTRACCION,
  openaiApiKeyAusente,
  resultadoExtraccionSchema,
} from '@cotizador/shared';
import OpenAI from 'openai';

type OpenAIConfig = {
  apiKey: string;
  modelo: string;
  temperatura: number;
  costoEntradaPor1k: number;
  costoSalidaPor1k: number;
};

/**
 * Adaptador remoto OpenAI. Solo vive en apps/api; el dominio no importa el SDK.
 */
export class ProveedorIaOpenAI implements ProveedorIa {
  readonly nombre = 'openai';
  readonly modelo: string;
  readonly versionPrompt = VERSION_PROMPT_EXTRACCION;

  private readonly client: OpenAI;
  private readonly temperatura: number;
  private readonly costoEntradaPor1k: number;
  private readonly costoSalidaPor1k: number;

  constructor(config: OpenAIConfig) {
    if (!config.apiKey) {
      throw openaiApiKeyAusente();
    }
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.modelo = config.modelo;
    this.temperatura = config.temperatura;
    this.costoEntradaPor1k = config.costoEntradaPor1k;
    this.costoSalidaPor1k = config.costoSalidaPor1k;
  }

  async extraerLineas(entrada: EntradaExtraccion): Promise<ResultadoExtraccion> {
    const inicio = Date.now();
    const mensajes = entrada.mensajes;
    if (!mensajes?.length) {
      throw Object.assign(new Error('mensajes compuestos requeridos para OpenAI'), {
        code: 'IA_ERROR_INTERNO',
      });
    }

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.modelo,
        temperature: this.temperatura,
        messages: mensajes.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'extraccion_lineas',
            strict: true,
            schema: OPENAI_EXTRACCION_JSON_SCHEMA as unknown as Record<
              string,
              unknown
            >,
          },
        },
      });
    } catch (err) {
      throw mapOpenAiError(err);
    }

    const content = completion.choices[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Devolver crudo inválido; ExtraccionIaService lo marca IA_SALIDA_INVALIDA
      parsed = { lineas: [], advertencias: ['JSON_PARSE_ERROR'], _raw: content };
    }

    const usage = completion.usage;
    const tokensEntrada = usage?.prompt_tokens;
    const tokensSalida = usage?.completion_tokens;
    const costoEstimado =
      tokensEntrada != null && tokensSalida != null
        ? (tokensEntrada / 1000) * this.costoEntradaPor1k +
          (tokensSalida / 1000) * this.costoSalidaPor1k
        : undefined;

    const body =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : { lineas: [], advertencias: [] };

    // Normalizar nulls de Structured Outputs a opcionales Zod
    const lineasNorm = (Array.isArray(body.lineas) ? body.lineas : []).map(
      (l: unknown) => {
        if (!l || typeof l !== 'object') return l;
        const row = l as Record<string, unknown>;
        const out: Record<string, unknown> = {
          textoSolicitado: row.textoSolicitado,
          cantidad: row.cantidad,
        };
        if (row.unidad != null && row.unidad !== '') out.unidad = row.unidad;
        if (row.notas != null && row.notas !== '') out.notas = row.notas;
        return out;
      },
    );

    const resultado = {
      lineas: lineasNorm,
      advertencias: Array.isArray(body.advertencias)
        ? (body.advertencias as string[])
        : [],
      metricas: {
        latenciaMs: Math.max(0, Date.now() - inicio),
        ...(tokensEntrada != null ? { tokensEntrada } : {}),
        ...(tokensSalida != null ? { tokensSalida } : {}),
        ...(costoEstimado != null ? { costoEstimado } : {}),
      },
    };

    // Si falla Zod aquí, dejamos que el servicio de etapa lo capture vía parse del crudo
    try {
      return resultadoExtraccionSchema.parse(resultado);
    } catch {
      return resultado as ResultadoExtraccion;
    }
  }
}

export function crearProveedorIaOpenAIDesdeEnv(): ProveedorIaOpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  if (!apiKey) {
    throw openaiApiKeyAusente();
  }
  return new ProveedorIaOpenAI({
    apiKey,
    modelo: process.env.IA_MODELO?.trim() || 'gpt-4o-mini',
    temperatura: Number(process.env.IA_TEMPERATURA ?? 0) || 0,
    costoEntradaPor1k: Number(process.env.IA_COSTO_ENTRADA_POR_1K ?? 0.00015),
    costoSalidaPor1k: Number(process.env.IA_COSTO_SALIDA_POR_1K ?? 0.0006),
  });
}

function mapOpenAiError(err: unknown): Error {
  if (err && typeof err === 'object') {
    const e = err as {
      status?: number;
      code?: string;
      message?: string;
      error?: { message?: string };
    };
    const status = e.status;
    const message = e.message ?? e.error?.message ?? 'OpenAI error';
    if (status === 429 || (status != null && status >= 500)) {
      return Object.assign(new Error(message), {
        status,
        code: 'IA_PROVEEDOR_NO_DISPONIBLE',
      });
    }
    if (status === 401 || status === 403) {
      return Object.assign(new Error(message), {
        status,
        code: 'IA_PROVEEDOR_NO_DISPONIBLE',
      });
    }
    return Object.assign(new Error(message), {
      status,
      code: 'IA_ERROR_INTERNO',
    });
  }
  return Object.assign(new Error(String(err)), { code: 'IA_ERROR_INTERNO' });
}
