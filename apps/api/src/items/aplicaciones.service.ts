import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoRegistro,
  Item,
  ItemAplicacion,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  aplicacionDuplicada,
  aplicacionNoEncontrada,
  construirTextoAplicacion,
  crearAplicacionSchema,
  editarAplicacionSchema,
  itemNoEncontrado,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { Repository } from 'typeorm';
import { mapAplicacion } from './items.mapper';

@Injectable()
export class AplicacionesService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ItemAplicacion)
    private readonly aplicacionRepo: Repository<ItemAplicacion>,
  ) {}

  async listar(ctx: OrgContext, itemId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_VER);
    await this.asegurarItem(ctx.organizacionId!, itemId);

    const apps = await this.aplicacionRepo.find({
      where: {
        itemId,
        organizacionId: ctx.organizacionId!,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
      order: { createdAt: 'ASC' },
    });
    return apps.map(mapAplicacion);
  }

  async crear(ctx: OrgContext, itemId: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_EDITAR);
    await this.asegurarItem(ctx.organizacionId!, itemId);

    const input = crearAplicacionSchema.parse(body);
    const textoNormalizado = construirTextoAplicacion(input.datos);
    await this.asegurarTextoUnico(
      ctx.organizacionId!,
      itemId,
      textoNormalizado,
    );

    const app = this.aplicacionRepo.create({
      organizacionId: ctx.organizacionId!,
      itemId,
      datos: input.datos,
      textoNormalizado,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.aplicacionRepo.save(app);
    return mapAplicacion(app);
  }

  async editar(
    ctx: OrgContext,
    itemId: string,
    aplicacionId: string,
    body: unknown,
  ) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_EDITAR);
    await this.asegurarItem(ctx.organizacionId!, itemId);

    const input = editarAplicacionSchema.parse(body);
    const app = await this.buscar(ctx.organizacionId!, itemId, aplicacionId);
    const textoNormalizado = construirTextoAplicacion(input.datos);
    await this.asegurarTextoUnico(
      ctx.organizacionId!,
      itemId,
      textoNormalizado,
      aplicacionId,
    );

    app.datos = input.datos;
    app.textoNormalizado = textoNormalizado;
    app.updatedById = ctx.usuarioId;
    await this.aplicacionRepo.save(app);
    return mapAplicacion(app);
  }

  async eliminar(ctx: OrgContext, itemId: string, aplicacionId: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_EDITAR);
    await this.asegurarItem(ctx.organizacionId!, itemId);

    const app = await this.buscar(ctx.organizacionId!, itemId, aplicacionId);
    app.estadoRegistro = EstadoRegistro.INACTIVO;
    app.updatedById = ctx.usuarioId;
    await this.aplicacionRepo.save(app);
    return mapAplicacion(app);
  }

  private async buscar(
    organizacionId: string,
    itemId: string,
    aplicacionId: string,
  ): Promise<ItemAplicacion> {
    const app = await this.aplicacionRepo.findOne({
      where: {
        id: aplicacionId,
        itemId,
        organizacionId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    if (!app) throw aplicacionNoEncontrada();
    return app;
  }

  private async asegurarTextoUnico(
    organizacionId: string,
    itemId: string,
    textoNormalizado: string,
    excluirId?: string,
  ) {
    const qb = this.aplicacionRepo
      .createQueryBuilder('a')
      .where('a.organizacionId = :organizacionId', { organizacionId })
      .andWhere('a.itemId = :itemId', { itemId })
      .andWhere('a.textoNormalizado = :textoNormalizado', { textoNormalizado })
      .andWhere('a.estadoRegistro = :estado', {
        estado: EstadoRegistro.ACTIVO,
      });
    if (excluirId) {
      qb.andWhere('a.id != :excluirId', { excluirId });
    }
    const existe = await qb.getOne();
    if (existe) throw aplicacionDuplicada();
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
