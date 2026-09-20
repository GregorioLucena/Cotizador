import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstadoPromptVersion,
  EstadoRegistro,
  PromptVersion,
  PropositoPrompt,
  Solicitud,
  Vertical,
} from '@cotizador/database';
import {
  type OrgContext,
  type PoliticaExtraccion,
  type ResultadoEvaluacionPrompt,
  type ProveedorIa,
  PERMISOS,
  PROVEEDOR_IA_TOKEN,
  CONTRATO_EXTRACCION_VERSION,
  POLITICA_EXTRACCION_DEFAULT,
  VERSION_PROMPT_EXTRACCION,
  VERTICAL_PROMPT_FALLBACK,
  componerPromptExtraccion,
  crearPromptVersionSchema,
  editarPromptVersionSchema,
  evaluarPromptSchema,
  politicaExtraccionSchema,
  resultadoEvaluacionPromptSchema,
  resultadoExtraccionSchema,
  requirePermission,
  requirePlataformaContext,
  promptNoEncontrado,
  promptSoloBorradorEditable,
  promptEstadoInvalido,
  promptCodigoDuplicado,
  promptPoliticaInvalida,
  promptEvaluacionSinMuestras,
  LIMITE_LINEAS_EXTRACCION,
  AppError,
} from '@cotizador/shared';
import { ZodError } from 'zod';

export type PromptVersionDto = {
  id: string;
  proposito: string;
  verticalCodigo: string;
  codigo: string;
  estado: string;
  contratoVersion: string;
  politica: PoliticaExtraccion;
  notasCambio: string | null;
  ultimaEvaluacion: ResultadoEvaluacionPrompt | null;
  publishedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IaConfigDto = {
  proveedor: string;
  modelo: string;
  temperatura: number;
  apiKeyConfigurada: boolean;
  versionesActivas: Array<{ verticalCodigo: string; codigo: string }>;
  contratoVersion: string;
  verticalFallback: string;
};

@Injectable()
export class PromptVersionesService {
  constructor(
    @InjectRepository(PromptVersion)
    private readonly promptRepo: Repository<PromptVersion>,
    @InjectRepository(Solicitud)
    private readonly solicitudRepo: Repository<Solicitud>,
    @InjectRepository(Vertical)
    private readonly verticalRepo: Repository<Vertical>,
    @Inject(PROVEEDOR_IA_TOKEN)
    private readonly proveedor: ProveedorIa,
  ) {}

  /**
   * Resuelve política: vertical de la org → GENERICO → embebida.
   */
  async obtenerPoliticaActiva(verticalCodigo?: string | null): Promise<{
    codigo: string;
    politica: PoliticaExtraccion;
    verticalCodigo: string;
    ausente: boolean;
  }> {
    const pedida = (verticalCodigo ?? '').trim().toUpperCase() || null;

    if (pedida) {
      const directa = await this.buscarActiva(pedida);
      if (directa) return directa;
    }

    if (pedida !== VERTICAL_PROMPT_FALLBACK) {
      const generica = await this.buscarActiva(VERTICAL_PROMPT_FALLBACK);
      if (generica) return generica;
    }

    return {
      codigo: VERSION_PROMPT_EXTRACCION,
      politica: POLITICA_EXTRACCION_DEFAULT,
      verticalCodigo: pedida ?? VERTICAL_PROMPT_FALLBACK,
      ausente: true,
    };
  }

  private async buscarActiva(verticalCodigo: string) {
    const activa = await this.promptRepo.findOne({
      where: {
        proposito: PropositoPrompt.EXTRACCION_LINEAS,
        estado: EstadoPromptVersion.ACTIVA,
        verticalCodigo,
      },
    });
    if (!activa) return null;
    const parsed = politicaExtraccionSchema.safeParse(activa.politica);
    return {
      codigo: activa.codigo,
      politica: parsed.success ? parsed.data : POLITICA_EXTRACCION_DEFAULT,
      verticalCodigo: activa.verticalCodigo,
      ausente: false,
    };
  }

  async config(ctx: OrgContext): Promise<IaConfigDto> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_VER);
    const activas = await this.promptRepo.find({
      where: {
        proposito: PropositoPrompt.EXTRACCION_LINEAS,
        estado: EstadoPromptVersion.ACTIVA,
      },
      order: { verticalCodigo: 'ASC' },
    });
    return {
      proveedor: this.proveedor.nombre,
      modelo: this.proveedor.modelo,
      temperatura: Number(process.env.IA_TEMPERATURA ?? 0) || 0,
      apiKeyConfigurada: Boolean(process.env.OPENAI_API_KEY?.trim()),
      versionesActivas: activas.map((a) => ({
        verticalCodigo: a.verticalCodigo,
        codigo: a.codigo,
      })),
      contratoVersion: CONTRATO_EXTRACCION_VERSION,
      verticalFallback: VERTICAL_PROMPT_FALLBACK,
    };
  }

  async listar(
    ctx: OrgContext,
    verticalCodigo?: string,
  ): Promise<PromptVersionDto[]> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_VER);
    const where: {
      proposito: PropositoPrompt;
      verticalCodigo?: string;
    } = { proposito: PropositoPrompt.EXTRACCION_LINEAS };
    if (verticalCodigo?.trim()) {
      where.verticalCodigo = verticalCodigo.trim().toUpperCase();
    }
    const rows = await this.promptRepo.find({
      where,
      order: { verticalCodigo: 'ASC', createdAt: 'DESC' },
    });
    return rows.map(mapPrompt);
  }

  async crear(ctx: OrgContext, body: unknown): Promise<PromptVersionDto> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_EDITAR);
    let input;
    try {
      input = crearPromptVersionSchema.parse(body);
    } catch (err) {
      throw promptPoliticaInvalida(
        err instanceof ZodError ? err.flatten() : err,
      );
    }
    await this.asegurarVerticalExiste(input.verticalCodigo);

    const existe = await this.promptRepo.findOne({
      where: { codigo: input.codigo },
    });
    if (existe) throw promptCodigoDuplicado(input.codigo);

    const row = await this.promptRepo.save(
      this.promptRepo.create({
        proposito: PropositoPrompt.EXTRACCION_LINEAS,
        verticalCodigo: input.verticalCodigo,
        codigo: input.codigo,
        estado: EstadoPromptVersion.BORRADOR,
        contratoVersion: CONTRATO_EXTRACCION_VERSION,
        politica: input.politica,
        notasCambio: input.notasCambio ?? null,
        createdById: ctx.usuarioId,
        updatedById: ctx.usuarioId,
      }),
    );
    return mapPrompt(row);
  }

  async editar(
    ctx: OrgContext,
    id: string,
    body: unknown,
  ): Promise<PromptVersionDto> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_EDITAR);
    const row = await this.promptRepo.findOne({ where: { id } });
    if (!row) throw promptNoEncontrado();
    if (row.estado !== EstadoPromptVersion.BORRADOR) {
      throw promptSoloBorradorEditable();
    }
    let input;
    try {
      input = editarPromptVersionSchema.parse(body);
    } catch (err) {
      throw promptPoliticaInvalida(
        err instanceof ZodError ? err.flatten() : err,
      );
    }
    if (input.politica) row.politica = input.politica;
    if (input.notasCambio !== undefined) {
      row.notasCambio = input.notasCambio ?? null;
    }
    row.updatedById = ctx.usuarioId;
    return mapPrompt(await this.promptRepo.save(row));
  }

  async publicar(ctx: OrgContext, id: string): Promise<PromptVersionDto> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_EDITAR);
    const row = await this.promptRepo.findOne({ where: { id } });
    if (!row) throw promptNoEncontrado();
    if (row.estado !== EstadoPromptVersion.BORRADOR) {
      throw promptEstadoInvalido({ estado: row.estado, operacion: 'publicar' });
    }
    row.estado = EstadoPromptVersion.PUBLICADA;
    row.publishedAt = new Date();
    row.updatedById = ctx.usuarioId;
    return mapPrompt(await this.promptRepo.save(row));
  }

  async activar(ctx: OrgContext, id: string): Promise<PromptVersionDto> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_EDITAR);
    const row = await this.promptRepo.findOne({ where: { id } });
    if (!row) throw promptNoEncontrado();
    if (
      row.estado !== EstadoPromptVersion.PUBLICADA &&
      row.estado !== EstadoPromptVersion.ACTIVA
    ) {
      throw promptEstadoInvalido({ estado: row.estado, operacion: 'activar' });
    }
    if (row.estado === EstadoPromptVersion.ACTIVA) {
      return mapPrompt(row);
    }

    await this.promptRepo.manager.transaction(async (em) => {
      await em.update(
        PromptVersion,
        {
          proposito: PropositoPrompt.EXTRACCION_LINEAS,
          verticalCodigo: row.verticalCodigo,
          estado: EstadoPromptVersion.ACTIVA,
        },
        { estado: EstadoPromptVersion.PUBLICADA },
      );
      row.estado = EstadoPromptVersion.ACTIVA;
      row.activatedAt = new Date();
      row.updatedById = ctx.usuarioId;
      await em.save(row);
    });

    const refreshed = await this.promptRepo.findOneOrFail({ where: { id } });
    return mapPrompt(refreshed);
  }

  async evaluar(
    ctx: OrgContext,
    id: string,
    body: unknown,
  ): Promise<PromptVersionDto> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_EDITAR);
    const row = await this.promptRepo.findOne({ where: { id } });
    if (!row) throw promptNoEncontrado();
    const { limiteMuestras } = evaluarPromptSchema.parse(body ?? {});

    const muestras = await this.solicitudRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.textoNormalizado'])
      .where('s.textoNormalizado IS NOT NULL')
      .andWhere("s.textoNormalizado <> ''")
      .orderBy('s.createdAt', 'DESC')
      .take(limiteMuestras)
      .getMany();

    if (muestras.length === 0) {
      throw promptEvaluacionSinMuestras();
    }

    const politicaParsed = politicaExtraccionSchema.safeParse(row.politica);
    const politica = politicaParsed.success
      ? politicaParsed.data
      : POLITICA_EXTRACCION_DEFAULT;

    let jsonValido = 0;
    let salidaInvalida = 0;
    let ceroLineas = 0;
    let erroresProveedor = 0;
    const latencias: number[] = [];

    for (const muestra of muestras) {
      const compuesto = componerPromptExtraccion({
        politica,
        codigoVersion: row.codigo,
        entrada: {
          textoNormalizado: muestra.textoNormalizado.slice(0, 4000),
          unidadesValidas: ['UND', 'M', 'KG'],
          limiteLineas: LIMITE_LINEAS_EXTRACCION,
        },
        nombreVertical: row.verticalCodigo,
      });
      try {
        const result = await this.proveedor.extraerLineas({
          textoNormalizado: muestra.textoNormalizado,
          unidadesValidas: ['UND', 'M', 'KG'],
          limiteLineas: LIMITE_LINEAS_EXTRACCION,
          mensajes: compuesto.mensajes,
          versionPromptOverride: row.codigo,
        });
        latencias.push(result.metricas.latenciaMs);
        const validado = resultadoExtraccionSchema.safeParse(result);
        if (!validado.success) {
          salidaInvalida += 1;
        } else {
          jsonValido += 1;
          if (validado.data.lineas.length === 0) ceroLineas += 1;
        }
      } catch {
        erroresProveedor += 1;
      }
    }

    const latenciasOrden = [...latencias].sort((a, b) => a - b);
    const evaluacion = resultadoEvaluacionPromptSchema.parse({
      muestras: muestras.length,
      jsonValido,
      salidaInvalida,
      ceroLineas,
      erroresProveedor,
      latenciaMsP50:
        latenciasOrden.length === 0
          ? null
          : latenciasOrden[Math.floor(latenciasOrden.length / 2)] ?? null,
      evaluadoAt: new Date().toISOString(),
    });

    row.ultimaEvaluacion = evaluacion;
    row.updatedById = ctx.usuarioId;
    return mapPrompt(await this.promptRepo.save(row));
  }

  previewCompuesto(
    politica: PoliticaExtraccion,
    codigo: string,
    verticalCodigo?: string,
  ) {
    return componerPromptExtraccion({
      politica,
      codigoVersion: codigo,
      entrada: {
        textoNormalizado:
          'necesito 2 tubos de 1/2, 10 codos y un pegamento azul porfa',
        unidadesValidas: ['UND', 'M', 'KG'],
        limiteLineas: LIMITE_LINEAS_EXTRACCION,
      },
      nombreVertical: verticalCodigo ?? 'Ferretería',
    });
  }

  private async asegurarVerticalExiste(codigo: string) {
    const v = await this.verticalRepo.findOne({
      where: { codigo, estadoRegistro: EstadoRegistro.ACTIVO },
    });
    if (!v) {
      throw new AppError(
        'PROMPT_POLITICA_INVALIDA',
        'La vertical indicada no existe o está inactiva.',
        400,
        { verticalCodigo: codigo },
      );
    }
  }
}

function mapPrompt(row: PromptVersion): PromptVersionDto {
  const politica = politicaExtraccionSchema.safeParse(row.politica);
  const evalParsed = row.ultimaEvaluacion
    ? resultadoEvaluacionPromptSchema.safeParse(row.ultimaEvaluacion)
    : null;
  return {
    id: row.id,
    proposito: row.proposito,
    verticalCodigo: row.verticalCodigo,
    codigo: row.codigo,
    estado: row.estado,
    contratoVersion: row.contratoVersion,
    politica: politica.success ? politica.data : POLITICA_EXTRACCION_DEFAULT,
    notasCambio: row.notasCambio,
    ultimaEvaluacion: evalParsed?.success ? evalParsed.data : null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
