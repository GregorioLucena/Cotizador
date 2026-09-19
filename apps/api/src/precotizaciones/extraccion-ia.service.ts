import { Inject, Injectable } from '@nestjs/common';
import {
  CODIGOS_IA,
  type CodigoIa,
  type EntradaExtraccion,
  type LineaExtraida,
  type ProveedorIa,
  PROVEEDOR_IA_TOKEN,
  LIMITE_LINEAS_EXTRACCION,
  resultadoExtraccionSchema,
} from '@cotizador/shared';
import { ZodError } from 'zod';

const DEFAULT_TIMEOUT_MS = 20_000;
const RETRY_WAIT_MS = 300;

export type ResultadoEtapaExtraccion = {
  exito: boolean;
  lineas: LineaExtraida[];
  advertencias: string[];
  proveedor: string;
  modelo: string;
  versionPrompt: string;
  latenciaMs: number;
  tokensEntrada?: number | null;
  tokensSalida?: number | null;
  costoEstimado?: string | null;
  errorCodigo: CodigoIa | string | null;
  errorDetalle: string | null;
  resultadoCrudo: unknown;
};

@Injectable()
export class ExtraccionIaService {
  constructor(
    @Inject(PROVEEDOR_IA_TOKEN)
    private readonly proveedor: ProveedorIa,
  ) {}

  async extraer(opts: {
    textoNormalizado: string;
    unidadesValidas: string[];
    usaIa: boolean;
    timeoutMs?: number;
  }): Promise<ResultadoEtapaExtraccion> {
    const inicio = Date.now();
    const baseMeta = {
      proveedor: this.proveedor.nombre,
      modelo: this.proveedor.modelo,
      versionPrompt: this.proveedor.versionPrompt,
    };

    if (!opts.usaIa || this.proveedor.nombre === 'none') {
      return {
        ...baseMeta,
        exito: false,
        lineas: [],
        advertencias: [CODIGOS_IA.DESACTIVADA],
        latenciaMs: 0,
        errorCodigo: CODIGOS_IA.DESACTIVADA,
        errorDetalle: 'IA desactivada para la organización o proveedor none',
        resultadoCrudo: { lineas: [] },
      };
    }

    const entrada: EntradaExtraccion = {
      textoNormalizado: opts.textoNormalizado,
      unidadesValidas: opts.unidadesValidas,
      limiteLineas: LIMITE_LINEAS_EXTRACCION,
    };
    const timeoutMs = opts.timeoutMs ?? Number(process.env.IA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

    let ultimoError: unknown = null;
    let intento = 0;
    const maxIntentos = 2; // original + 1 reintento

    while (intento < maxIntentos) {
      intento += 1;
      try {
        const crudo = await this.conTimeout(
          () => this.proveedor.extraerLineas(entrada),
          timeoutMs,
        );
        try {
          const validado = resultadoExtraccionSchema.parse(crudo);
          const advertencias = [...validado.advertencias];
          if (validado.lineas.length === 0) {
            advertencias.push(CODIGOS_IA.SIN_LINEAS);
          }
          return {
            ...baseMeta,
            exito: true,
            lineas: validado.lineas,
            advertencias,
            latenciaMs: validado.metricas.latenciaMs || Date.now() - inicio,
            tokensEntrada: validado.metricas.tokensEntrada ?? null,
            tokensSalida: validado.metricas.tokensSalida ?? null,
            costoEstimado:
              validado.metricas.costoEstimado != null
                ? String(validado.metricas.costoEstimado)
                : null,
            errorCodigo: null,
            errorDetalle: null,
            resultadoCrudo: crudo,
          };
        } catch (zerr) {
          // Validación Zod: no reintentar
          const detalle =
            zerr instanceof ZodError
              ? zerr.issues.map((i) => i.message).join('; ')
              : String(zerr);
          return {
            ...baseMeta,
            exito: false,
            lineas: [],
            advertencias: [CODIGOS_IA.SALIDA_INVALIDA],
            latenciaMs: Date.now() - inicio,
            errorCodigo: CODIGOS_IA.SALIDA_INVALIDA,
            errorDetalle: detalle.slice(0, 500),
            resultadoCrudo: crudo,
          };
        }
      } catch (err) {
        ultimoError = err;
        const clasificado = clasificarErrorIa(err);
        if (clasificado === CODIGOS_IA.TIMEOUT) {
          if (intento < maxIntentos) {
            await sleep(RETRY_WAIT_MS);
            continue;
          }
          return fallido(
            baseMeta,
            inicio,
            CODIGOS_IA.TIMEOUT,
            String(err),
          );
        }
        if (
          clasificado === CODIGOS_IA.PROVEEDOR_NO_DISPONIBLE &&
          intento < maxIntentos
        ) {
          await sleep(RETRY_WAIT_MS);
          continue;
        }
        return fallido(baseMeta, inicio, clasificado, String(err));
      }
    }

    return fallido(
      baseMeta,
      inicio,
      CODIGOS_IA.ERROR_INTERNO,
      String(ultimoError ?? 'desconocido'),
    );
  }

  private async conTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(Object.assign(new Error('IA_TIMEOUT'), { code: 'IA_TIMEOUT' })),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function clasificarErrorIa(err: unknown): CodigoIa {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; status?: number; message?: string };
    if (e.code === 'IA_TIMEOUT' || e.message === 'IA_TIMEOUT') {
      return CODIGOS_IA.TIMEOUT;
    }
    if (e.status === 429 || (e.status != null && e.status >= 500)) {
      return CODIGOS_IA.PROVEEDOR_NO_DISPONIBLE;
    }
    if (
      typeof e.message === 'string' &&
      /ECONN|ENOTFOUND|ETIMEDOUT|network/i.test(e.message)
    ) {
      return CODIGOS_IA.PROVEEDOR_NO_DISPONIBLE;
    }
  }
  return CODIGOS_IA.ERROR_INTERNO;
}

function fallido(
  baseMeta: { proveedor: string; modelo: string; versionPrompt: string },
  inicio: number,
  codigo: CodigoIa,
  detalle: string,
): ResultadoEtapaExtraccion {
  return {
    ...baseMeta,
    exito: false,
    lineas: [],
    advertencias: [codigo],
    latenciaMs: Date.now() - inicio,
    errorCodigo: codigo,
    errorDetalle: detalle.slice(0, 500),
    resultadoCrudo: { error: detalle.slice(0, 200) },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
