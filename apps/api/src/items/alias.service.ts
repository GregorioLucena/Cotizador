import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoRegistro,
  Item,
  ItemAlias,
  OrigenAlias,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  aliasDuplicado,
  aliasLimiteExcedido,
  aliasMuyCorto,
  aliasNoEncontrado,
  aliasAprendidoSinConfirmacion,
  crearAliasSchema,
  itemNoEncontrado,
  normalizarTexto,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { DataSource, Repository } from 'typeorm';
import { ItemsUsoHelper } from '../maestras/items-uso.helper';
import { mapAlias } from './items.mapper';

const MAX_ALIAS_ACTIVOS = 50;

@Injectable()
export class AliasService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ItemAlias)
    private readonly aliasRepo: Repository<ItemAlias>,
    private readonly itemsUso: ItemsUsoHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, itemId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_VER);
    await this.asegurarItem(ctx.organizacionId!, itemId);

    const alias = await this.aliasRepo.find({
      where: { itemId, organizacionId: ctx.organizacionId! },
      order: { alias: 'ASC' },
    });
    return alias.map(mapAlias);
  }

  async crear(ctx: OrgContext, itemId: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR);

    const input = crearAliasSchema.parse(body);
    const origen = (input.origen ?? 'MANUAL') as OrigenAlias;
    if (origen === OrigenAlias.APRENDIDO && input.confirmado !== true) {
      throw aliasAprendidoSinConfirmacion();
    }

    return this.crearAliasInterno(
      ctx,
      itemId,
      input.alias,
      origen,
      false,
    );
  }

  /**
   * Crea alias sin exigir permiso de alias (p. ej. cierre de término o alta de item).
   * El llamador debe haber verificado el permiso adecuado.
   */
  async crearAliasInterno(
    ctx: OrgContext & { organizacionId: string },
    itemId: string,
    aliasTexto: string,
    origen: OrigenAlias,
    omitirPermisoAlias: boolean,
  ) {
    if (!omitirPermisoAlias) {
      requirePermission(ctx, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR);
    }

    const item = await this.asegurarItem(ctx.organizacionId, itemId);
    const normalizado = normalizarTexto(aliasTexto);
    if (normalizado.length < 2) {
      throw aliasMuyCorto();
    }

    const activos = await this.aliasRepo.count({
      where: {
        itemId,
        organizacionId: ctx.organizacionId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    if (activos >= MAX_ALIAS_ACTIVOS) {
      throw aliasLimiteExcedido();
    }

    const existente = await this.aliasRepo.findOne({
      where: { itemId, normalizado },
    });
    if (existente) {
      if (existente.estadoRegistro === EstadoRegistro.ACTIVO) {
        throw aliasDuplicado();
      }
      // Reactivar
      existente.alias = aliasTexto;
      existente.origen = origen;
      existente.estadoRegistro = EstadoRegistro.ACTIVO;
      existente.updatedById = ctx.usuarioId;

      const avisos = await this.calcularAdvertencias(
        ctx.organizacionId,
        item,
        normalizado,
        existente.id,
      );

      return this.dataSource.transaction(async (manager) => {
        await manager.save(ItemAlias, existente);
        item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
          manager,
          ctx.organizacionId,
          item,
        );
        item.updatedById = ctx.usuarioId;
        await manager.save(Item, item);
        return { ...mapAlias(existente), ...avisos };
      });
    }

    const avisos = await this.calcularAdvertencias(
      ctx.organizacionId,
      item,
      normalizado,
    );

    const alias = this.aliasRepo.create({
      organizacionId: ctx.organizacionId,
      itemId,
      alias: aliasTexto,
      normalizado,
      origen,
      vecesUsado: 0,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    return this.dataSource.transaction(async (manager) => {
      await manager.save(ItemAlias, alias);
      item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
        manager,
        ctx.organizacionId,
        item,
      );
      item.updatedById = ctx.usuarioId;
      await manager.save(Item, item);
      return { ...mapAlias(alias), ...avisos };
    });
  }

  async depurar(ctx: OrgContext, itemId: string, aliasId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ALIAS_ADMINISTRAR);

    const item = await this.asegurarItem(ctx.organizacionId!, itemId);
    const alias = await this.aliasRepo.findOne({
      where: {
        id: aliasId,
        itemId,
        organizacionId: ctx.organizacionId!,
      },
    });
    if (!alias) throw aliasNoEncontrado();

    alias.estadoRegistro = EstadoRegistro.INACTIVO;
    alias.updatedById = ctx.usuarioId;

    return this.dataSource.transaction(async (manager) => {
      await manager.save(ItemAlias, alias);
      item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
        manager,
        ctx.organizacionId!,
        item,
      );
      item.updatedById = ctx.usuarioId;
      await manager.save(Item, item);
      return mapAlias(alias);
    });
  }

  private async calcularAdvertencias(
    organizacionId: string,
    item: Item,
    normalizado: string,
    excluirAliasId?: string,
  ): Promise<{
    advertencias: string[];
    itemsCompartidos: Array<{ itemId: string; nombre: string }>;
  }> {
    const advertencias: string[] = [];
    const nombreNorm = normalizarTexto(item.nombre);
    if (normalizado === nombreNorm) {
      advertencias.push('ALIAS_REDUNDANTE');
    }

    const qb = this.aliasRepo
      .createQueryBuilder('a')
      .innerJoin(Item, 'i', 'i.id = a.itemId')
      .where('a.organizacionId = :organizacionId', { organizacionId })
      .andWhere('a.normalizado = :normalizado', { normalizado })
      .andWhere('a.estadoRegistro = :estado', {
        estado: EstadoRegistro.ACTIVO,
      })
      .andWhere('a.itemId != :itemId', { itemId: item.id });
    if (excluirAliasId) {
      qb.andWhere('a.id != :excluirAliasId', { excluirAliasId });
    }
    const otros = await qb
      .select('a.itemId', 'itemId')
      .addSelect('i.nombre', 'nombre')
      .getRawMany<{ itemId: string; nombre: string }>();

    const itemsCompartidos = otros.map((o) => ({
      itemId: o.itemId,
      nombre: o.nombre,
    }));
    if (itemsCompartidos.length > 0) {
      advertencias.push('ALIAS_COMPARTIDO_CON_OTRO_ITEM');
    }
    return { advertencias, itemsCompartidos };
  }

  private async asegurarItem(
    organizacionId: string,
    itemId: string,
  ): Promise<Item> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, organizacionId },
    });
    if (!item) throw itemNoEncontrado();
    return item;
  }
}
