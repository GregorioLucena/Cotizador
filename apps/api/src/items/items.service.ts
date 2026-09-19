import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Categoria,
  DefinicionAtributo,
  EstadoRegistro,
  Item,
  ItemAlias,
  ItemAplicacion,
  Marca,
  OrigenAlias,
  TipoItem,
  UnidadMedida,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  aliasDuplicado,
  aliasLimiteExcedido,
  aliasMuyCorto,
  categoriaInactiva,
  categoriaNoEncontrada,
  crearItemSchema,
  editarItemSchema,
  itemNoEncontrado,
  itemSerializadoStockInvalido,
  itemServicioNoAdmiteStock,
  itemSkuDuplicado,
  itemStockNegativo,
  itemYaInactivo,
  listarItemsQuerySchema,
  marcaInactiva,
  marcaNoEncontrada,
  normalizarTexto,
  requireOrganizacionContext,
  requirePermission,
  unidadMedidaInactiva,
  unidadMedidaNoEncontrada,
  validarAtributos,
} from '@cotizador/shared';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ItemsUsoHelper } from '../maestras/items-uso.helper';
import { mapItemDetalle, mapItemResumen } from './items.mapper';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(ItemAlias)
    private readonly aliasRepo: Repository<ItemAlias>,
    @InjectRepository(ItemAplicacion)
    private readonly aplicacionRepo: Repository<ItemAplicacion>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Marca)
    private readonly marcaRepo: Repository<Marca>,
    @InjectRepository(UnidadMedida)
    private readonly unidadRepo: Repository<UnidadMedida>,
    @InjectRepository(DefinicionAtributo)
    private readonly definicionRepo: Repository<DefinicionAtributo>,
    private readonly itemsUso: ItemsUsoHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_VER);

    const input = listarItemsQuerySchema.parse(query);
    const qb = this.itemRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.marca', 'marca')
      .leftJoinAndSelect('i.categoria', 'categoria')
      .leftJoinAndSelect('i.unidadMedida', 'unidad')
      .where('i.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (input.estadoRegistro !== 'TODOS') {
      qb.andWhere('i.estadoRegistro = :estado', {
        estado: input.estadoRegistro,
      });
    }
    if (input.categoriaId) {
      qb.andWhere('i.categoriaId = :categoriaId', {
        categoriaId: input.categoriaId,
      });
    }
    if (input.marcaId) {
      qb.andWhere('i.marcaId = :marcaId', { marcaId: input.marcaId });
    }
    if (input.tipoItem) {
      qb.andWhere('i.tipoItem = :tipoItem', { tipoItem: input.tipoItem });
    }
    if (input.search) {
      qb.andWhere(
        '(i.nombre ILIKE :search OR i.sku ILIKE :search OR i.textoBusqueda ILIKE :searchNorm)',
        {
          search: `%${input.search}%`,
          searchNorm: `%${input.search.toLowerCase()}%`,
        },
      );
    }

    const ordenCol =
      input.orden === 'sku'
        ? 'i.sku'
        : input.orden === 'updatedAt'
          ? 'i.updatedAt'
          : 'i.nombre';
    qb.orderBy(ordenCol, input.direccion)
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapItemResumen),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit) || 0,
      },
    };
  }

  async obtener(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_VER);
    return this.cargarDetalle(ctx.organizacionId!, id);
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_CREAR);

    const input = crearItemSchema.parse(body);
    const orgId = ctx.organizacionId!;
    const tipoItem = (input.tipoItem ?? TipoItem.FUNGIBLE) as TipoItem;
    const controlaStock = input.controlaStock ?? false;
    const stockAproximado = this.normalizarStock(input.stockAproximado);

    this.validarReglasStock(tipoItem, controlaStock, stockAproximado);

    const sku = input.sku ? input.sku.trim().toUpperCase() : null;
    if (sku) {
      await this.asegurarSkuUnico(orgId, sku);
    }

    const unidad = await this.resolverUnidad(orgId, input.unidadMedidaId, true);
    const categoria =
      input.categoriaId != null
        ? await this.resolverCategoria(orgId, input.categoriaId, true)
        : null;
    const marca =
      input.marcaId != null
        ? await this.resolverMarca(orgId, input.marcaId, true)
        : null;

    const definiciones = await this.definicionesActivas(orgId);
    const atributos = validarAtributos(input.atributos, definiciones);

    const item = this.itemRepo.create({
      organizacionId: orgId,
      sku,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      categoriaId: categoria?.id ?? null,
      marcaId: marca?.id ?? null,
      unidadMedidaId: unidad.id,
      tipoItem,
      atributos,
      textoBusqueda: '',
      controlaStock: tipoItem === TipoItem.SERVICIO ? false : controlaStock,
      stockAproximado:
        tipoItem === TipoItem.SERVICIO || !controlaStock
          ? null
          : stockAproximado,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    const aliasIniciales = input.alias ?? [];

    const guardado = await this.dataSource.transaction(async (manager) => {
      await manager.save(Item, item);

      for (const texto of aliasIniciales) {
        await this.persistirAliasEnTx(
          manager,
          orgId,
          item.id,
          texto,
          OrigenAlias.MANUAL,
          ctx.usuarioId,
        );
      }

      item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
        manager,
        orgId,
        item,
      );
      await manager.save(Item, item);
      return item;
    });

    return this.cargarDetalle(orgId, guardado.id);
  }

  private async persistirAliasEnTx(
    manager: EntityManager,
    organizacionId: string,
    itemId: string,
    aliasTexto: string,
    origen: OrigenAlias,
    usuarioId: string,
  ) {
    const normalizado = normalizarTexto(aliasTexto);
    if (normalizado.length < 2) throw aliasMuyCorto();

    const activos = await manager.count(ItemAlias, {
      where: {
        itemId,
        organizacionId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
    if (activos >= 50) throw aliasLimiteExcedido();

    const existente = await manager.findOne(ItemAlias, {
      where: { itemId, normalizado },
    });
    if (existente?.estadoRegistro === EstadoRegistro.ACTIVO) {
      throw aliasDuplicado();
    }
    if (existente) {
      existente.alias = aliasTexto;
      existente.origen = origen;
      existente.estadoRegistro = EstadoRegistro.ACTIVO;
      existente.updatedById = usuarioId;
      await manager.save(ItemAlias, existente);
      return;
    }

    await manager.save(
      ItemAlias,
      manager.create(ItemAlias, {
        organizacionId,
        itemId,
        alias: aliasTexto,
        normalizado,
        origen,
        vecesUsado: 0,
        estadoRegistro: EstadoRegistro.ACTIVO,
        createdById: usuarioId,
        updatedById: usuarioId,
      }),
    );
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_EDITAR);

    const input = editarItemSchema.parse(body);
    const orgId = ctx.organizacionId!;
    const item = await this.buscar(orgId, id);

    // Inactivación
    if (input.estadoRegistro === 'INACTIVO') {
      if (item.estadoRegistro === EstadoRegistro.INACTIVO) {
        throw itemYaInactivo();
      }
      item.estadoRegistro = EstadoRegistro.INACTIVO;
      item.updatedById = ctx.usuarioId;
      await this.itemRepo.save(item);
      return this.cargarDetalle(orgId, id);
    }

    // Reactivación
    if (
      input.estadoRegistro === 'ACTIVO' &&
      item.estadoRegistro === EstadoRegistro.INACTIVO
    ) {
      await this.validarParaReactivar(orgId, item, input);
      item.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    if (input.nombre !== undefined) item.nombre = input.nombre;
    if (input.descripcion !== undefined) {
      item.descripcion = input.descripcion;
    }

    if (input.sku !== undefined) {
      const sku = input.sku ? input.sku.trim().toUpperCase() : null;
      if (sku && sku !== item.sku) {
        await this.asegurarSkuUnico(orgId, sku, id);
      }
      item.sku = sku;
    }

    if (input.unidadMedidaId !== undefined) {
      if (input.unidadMedidaId !== item.unidadMedidaId) {
        const unidad = await this.resolverUnidad(
          orgId,
          input.unidadMedidaId,
          true,
        );
        item.unidadMedidaId = unidad.id;
      }
    }

    if (input.categoriaId !== undefined) {
      if (input.categoriaId === null) {
        item.categoriaId = null;
      } else if (input.categoriaId !== item.categoriaId) {
        const cat = await this.resolverCategoria(
          orgId,
          input.categoriaId,
          true,
        );
        item.categoriaId = cat.id;
      }
    }

    if (input.marcaId !== undefined) {
      if (input.marcaId === null) {
        item.marcaId = null;
      } else if (input.marcaId !== item.marcaId) {
        const marca = await this.resolverMarca(orgId, input.marcaId, true);
        item.marcaId = marca.id;
      }
    }

    const tipoItem = (input.tipoItem ?? item.tipoItem) as TipoItem;
    const controlaStock =
      input.controlaStock !== undefined
        ? input.controlaStock
        : item.controlaStock;
    let stockAproximado =
      input.stockAproximado !== undefined
        ? this.normalizarStock(input.stockAproximado)
        : item.stockAproximado ?? null;

    if (input.controlaStock === false) {
      stockAproximado = null;
    }

    this.validarReglasStock(tipoItem, controlaStock, stockAproximado);
    item.tipoItem = tipoItem;
    item.controlaStock = tipoItem === TipoItem.SERVICIO ? false : controlaStock;
    item.stockAproximado =
      tipoItem === TipoItem.SERVICIO || !item.controlaStock
        ? null
        : stockAproximado;

    if (input.atributos !== undefined) {
      const definiciones = await this.definicionesActivas(orgId);
      const conservarInactivas = await this.atributosDeDefinicionesInactivas(
        orgId,
        item.atributos ?? {},
      );
      item.atributos = validarAtributos(input.atributos, definiciones, {
        conservarInactivas,
      });
    }

    item.updatedById = ctx.usuarioId;

    await this.dataSource.transaction(async (manager) => {
      item.textoBusqueda = await this.itemsUso.construirTextoBusqueda(
        manager,
        orgId,
        item,
      );
      await manager.save(Item, item);
    });

    return this.cargarDetalle(orgId, id);
  }

  async reindexar(ctx: OrgContext) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_ITEMS_EDITAR);

    return this.dataSource.transaction(async (manager) => {
      return this.itemsUso.reindexarOrganizacion(manager, ctx.organizacionId!);
    });
  }

  private async validarParaReactivar(
    orgId: string,
    item: Item,
    input: {
      unidadMedidaId?: string;
      categoriaId?: string | null;
      marcaId?: string | null;
      atributos?: Record<string, unknown>;
      sku?: string | null;
    },
  ) {
    if (item.sku) {
      await this.asegurarSkuUnico(orgId, item.sku, item.id);
    }
    const unidadId = input.unidadMedidaId ?? item.unidadMedidaId;
    await this.resolverUnidad(orgId, unidadId, true);

    const catId =
      input.categoriaId !== undefined ? input.categoriaId : item.categoriaId;
    if (catId) await this.resolverCategoria(orgId, catId, true);

    const marcaId =
      input.marcaId !== undefined ? input.marcaId : item.marcaId;
    if (marcaId) await this.resolverMarca(orgId, marcaId, true);

    const definiciones = await this.definicionesActivas(orgId);
    const attrs = input.atributos ?? item.atributos;
    const conservarInactivas = await this.atributosDeDefinicionesInactivas(
      orgId,
      item.atributos ?? {},
    );
    validarAtributos(attrs, definiciones, { conservarInactivas });
  }

  private validarReglasStock(
    tipoItem: TipoItem,
    controlaStock: boolean,
    stockAproximado: string | null,
  ) {
    if (tipoItem === TipoItem.SERVICIO) {
      if (controlaStock || (stockAproximado !== null && Number(stockAproximado) > 0)) {
        throw itemServicioNoAdmiteStock();
      }
    }
    if (stockAproximado !== null && Number(stockAproximado) < 0) {
      throw itemStockNegativo();
    }
    if (tipoItem === TipoItem.SERIALIZADO && stockAproximado !== null) {
      const n = Number(stockAproximado);
      if (n !== 0 && n !== 1) {
        throw itemSerializadoStockInvalido();
      }
    }
  }

  private normalizarStock(
    valor: string | null | undefined,
  ): string | null {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number(valor);
    if (n < 0) throw itemStockNegativo();
    return n.toFixed(4);
  }

  private async asegurarSkuUnico(
    organizacionId: string,
    sku: string,
    excluirId?: string,
  ) {
    const qb = this.itemRepo
      .createQueryBuilder('i')
      .where('i.organizacionId = :organizacionId', { organizacionId })
      .andWhere('UPPER(TRIM(i.sku)) = :sku', { sku });
    if (excluirId) {
      qb.andWhere('i.id != :excluirId', { excluirId });
    }
    const otro = await qb.getOne();
    if (otro) throw itemSkuDuplicado({ itemId: otro.id });
  }

  private async resolverUnidad(
    organizacionId: string,
    id: string,
    exigirActiva: boolean,
  ): Promise<UnidadMedida> {
    const u = await this.unidadRepo.findOne({ where: { id, organizacionId } });
    if (!u) throw unidadMedidaNoEncontrada();
    if (exigirActiva && u.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw unidadMedidaInactiva();
    }
    return u;
  }

  private async resolverCategoria(
    organizacionId: string,
    id: string,
    exigirActiva: boolean,
  ): Promise<Categoria> {
    const c = await this.categoriaRepo.findOne({
      where: { id, organizacionId },
    });
    if (!c) throw categoriaNoEncontrada();
    if (exigirActiva && c.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw categoriaInactiva();
    }
    return c;
  }

  private async resolverMarca(
    organizacionId: string,
    id: string,
    exigirActiva: boolean,
  ): Promise<Marca> {
    const m = await this.marcaRepo.findOne({ where: { id, organizacionId } });
    if (!m) throw marcaNoEncontrada();
    if (exigirActiva && m.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw marcaInactiva();
    }
    return m;
  }

  private async definicionesActivas(organizacionId: string) {
    return this.definicionRepo.find({
      where: {
        organizacionId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
    });
  }

  private async atributosDeDefinicionesInactivas(
    organizacionId: string,
    atributosActuales: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const codigos = Object.keys(atributosActuales);
    if (codigos.length === 0) return {};
    const activas = await this.definicionesActivas(organizacionId);
    const activosSet = new Set(activas.map((d) => d.codigo));
    const conservar: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(atributosActuales)) {
      if (!activosSet.has(k)) conservar[k] = v;
    }
    return conservar;
  }

  private async buscar(organizacionId: string, id: string): Promise<Item> {
    const item = await this.itemRepo.findOne({
      where: { id, organizacionId },
    });
    if (!item) throw itemNoEncontrado();
    return item;
  }

  private async cargarDetalle(organizacionId: string, id: string) {
    const item = await this.itemRepo.findOne({
      where: { id, organizacionId },
      relations: ['marca', 'categoria', 'unidadMedida'],
    });
    if (!item) throw itemNoEncontrado();

    let padre: Categoria | null = null;
    if (item.categoria?.categoriaPadreId) {
      padre =
        (await this.categoriaRepo.findOne({
          where: {
            id: item.categoria.categoriaPadreId,
            organizacionId,
          },
        })) ?? null;
    }

    const alias = await this.aliasRepo.find({
      where: { itemId: id, organizacionId },
      order: { alias: 'ASC' },
    });
    const aplicaciones = await this.aplicacionRepo.find({
      where: {
        itemId: id,
        organizacionId,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
      order: { createdAt: 'ASC' },
    });

    return mapItemDetalle(item, {
      categoria: item.categoria ?? null,
      padre,
      marca: item.marca ?? null,
      unidadMedida: item.unidadMedida,
      alias,
      aplicaciones,
      advertencias: [],
    });
  }
}
