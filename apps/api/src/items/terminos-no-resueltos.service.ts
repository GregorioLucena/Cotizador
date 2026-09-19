import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoRegistro,
  OrigenAlias,
  TerminoNoResuelto,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  ForbiddenError,
  cerrarTerminoSchema,
  hasPermission,
  listarTerminosQuerySchema,
  requireOrganizacionContext,
  requirePermission,
  terminoNoEncontrado,
  terminoYaCerrado,
} from '@cotizador/shared';
import { Repository } from 'typeorm';
import { AliasService } from './alias.service';

@Injectable()
export class TerminosNoResueltosService {
  constructor(
    @InjectRepository(TerminoNoResuelto)
    private readonly terminoRepo: Repository<TerminoNoResuelto>,
    private readonly aliasService: AliasService,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_VER);

    const input = listarTerminosQuerySchema.parse(query);
    const qb = this.terminoRepo
      .createQueryBuilder('t')
      .where('t.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (input.estadoRegistro !== 'TODOS') {
      qb.andWhere('t.estadoRegistro = :estado', {
        estado: input.estadoRegistro,
      });
    }

    qb.orderBy('t.vecesVisto', 'DESC')
      .addOrderBy('t.ultimaVezAt', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((t) => this.mapTermino(t)),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit) || 0,
      },
    };
  }

  async cerrar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);

    const puedeCerrar =
      hasPermission(ctx, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR) ||
      hasPermission(ctx, PERMISOS.CATALOGO_ITEMS_CREAR);
    if (!puedeCerrar) {
      throw new ForbiddenError();
    }

    const input = cerrarTerminoSchema.parse(body);
    const termino = await this.terminoRepo.findOne({
      where: { id, organizacionId: ctx.organizacionId! },
    });
    if (!termino) throw terminoNoEncontrado();
    if (termino.estadoRegistro === EstadoRegistro.INACTIVO) {
      throw terminoYaCerrado();
    }

    if (input.accion === 'DESCARTAR') {
      termino.estadoRegistro = EstadoRegistro.INACTIVO;
      termino.resueltoConItemId = null;
      termino.updatedById = ctx.usuarioId;
      await this.terminoRepo.save(termino);
      return this.mapTermino(termino);
    }

    const itemId = input.itemId!;
    await this.aliasService.crearAliasInterno(
      ctx as OrgContext & { organizacionId: string },
      itemId,
      termino.ejemploOriginal,
      OrigenAlias.APRENDIDO,
      true,
    );

    termino.estadoRegistro = EstadoRegistro.INACTIVO;
    termino.resueltoConItemId = itemId;
    termino.updatedById = ctx.usuarioId;
    await this.terminoRepo.save(termino);
    return this.mapTermino(termino);
  }

  private mapTermino(t: TerminoNoResuelto) {
    return {
      id: t.id,
      textoNormalizado: t.textoNormalizado,
      ejemploOriginal: t.ejemploOriginal,
      vecesVisto: t.vecesVisto,
      ultimaVezAt: t.ultimaVezAt.toISOString(),
      resueltoConItemId: t.resueltoConItemId ?? null,
      estadoRegistro: t.estadoRegistro,
    };
  }
}
