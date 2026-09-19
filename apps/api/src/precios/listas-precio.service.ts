import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConfiguracionCotizacion,
  EstadoRegistro,
  Item,
  ListaPrecio,
  Moneda,
  Organizacion,
  PrecioItem,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearListaPrecioSchema,
  editarListaPrecioSchema,
  formatImporte,
  itemNoEncontrado,
  listaCodigoDuplicado,
  listaInactiva,
  listaMonedaDistintaDeBase,
  listaMonedaInactiva,
  listaNoEncontrada,
  listaPredeterminadaRequerida,
  listaVigenciaInvalida,
  listQuerySchema,
  precioItemInactivo,
  requireOrganizacionContext,
  requirePermission,
  upsertPrecioSchema,
} from '@cotizador/shared';
import { DataSource, Repository } from 'typeorm';
import { mapListaPrecio, mapPrecioItem } from './precios.mapper';

@Injectable()
export class ListasPrecioService {
  constructor(
    @InjectRepository(ListaPrecio)
    private readonly listaRepo: Repository<ListaPrecio>,
    @InjectRepository(PrecioItem)
    private readonly precioRepo: Repository<PrecioItem>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Organizacion)
    private readonly orgRepo: Repository<Organizacion>,
    @InjectRepository(Moneda)
    private readonly monedaRepo: Repository<Moneda>,
    @InjectRepository(ConfiguracionCotizacion)
    private readonly configRepo: Repository<ConfiguracionCotizacion>,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_LISTAS_VER);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);
    const qb = this.listaRepo
      .createQueryBuilder('l')
      .where('l.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('l.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere('(l.nombre ILIKE :search OR l.codigo ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('l.esPredeterminada', 'DESC')
      .addOrderBy('l.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapListaPrecio),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async obtener(ctx: OrgContext, id: string) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_LISTAS_VER);
    const lista = await this.buscarLista(ctx.organizacionId!, id);
    return mapListaPrecio(lista);
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_LISTAS_ADMINISTRAR);

    const input = crearListaPrecioSchema.parse(body);
    await this.asegurarCodigoUnico(ctx.organizacionId!, input.codigo);
    await this.validarMonedaBase(ctx.organizacionId!, input.monedaId);

    const esPredeterminada = input.esPredeterminada === true;

    return this.dataSource.transaction(async (manager) => {
      const hayPredeterminadaActiva = await manager.exists(ListaPrecio, {
        where: {
          organizacionId: ctx.organizacionId!,
          esPredeterminada: true,
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
      });
      const debeSerPredeterminada = esPredeterminada || !hayPredeterminadaActiva;

      if (debeSerPredeterminada) {
        await manager.update(
          ListaPrecio,
          {
            organizacionId: ctx.organizacionId!,
            esPredeterminada: true,
          },
          { esPredeterminada: false, updatedById: ctx.usuarioId },
        );
      }

      const lista = manager.create(ListaPrecio, {
        organizacionId: ctx.organizacionId!,
        nombre: input.nombre,
        codigo: input.codigo,
        monedaId: input.monedaId,
        esPredeterminada: debeSerPredeterminada,
        vigenciaDesde: input.vigenciaDesde ?? null,
        vigenciaHasta: input.vigenciaHasta ?? null,
        estadoRegistro: EstadoRegistro.ACTIVO,
        createdById: ctx.usuarioId,
        updatedById: ctx.usuarioId,
      });
      await manager.save(ListaPrecio, lista);

      if (lista.esPredeterminada) {
        await manager.update(
          ConfiguracionCotizacion,
          { organizacionId: ctx.organizacionId! },
          {
            listaPrecioPredeterminadaId: lista.id,
            updatedById: ctx.usuarioId,
          },
        );
      }

      return mapListaPrecio(lista);
    });
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_LISTAS_ADMINISTRAR);

    const input = editarListaPrecioSchema.parse(body);
    const lista = await this.buscarLista(ctx.organizacionId!, id);

    if (input.codigo !== undefined && input.codigo !== lista.codigo) {
      await this.asegurarCodigoUnico(ctx.organizacionId!, input.codigo, id);
      lista.codigo = input.codigo;
    }
    if (input.nombre !== undefined) lista.nombre = input.nombre;
    if (input.monedaId !== undefined) {
      await this.validarMonedaBase(ctx.organizacionId!, input.monedaId);
      lista.monedaId = input.monedaId;
    }
    if (input.vigenciaDesde !== undefined) {
      lista.vigenciaDesde = input.vigenciaDesde;
    }
    if (input.vigenciaHasta !== undefined) {
      lista.vigenciaHasta = input.vigenciaHasta;
    }
    if (
      lista.vigenciaDesde &&
      lista.vigenciaHasta &&
      lista.vigenciaHasta < lista.vigenciaDesde
    ) {
      throw listaVigenciaInvalida();
    }

    const marcarPredeterminada = input.esPredeterminada === true;
    const inactivar =
      input.estadoRegistro === 'INACTIVO' &&
      lista.estadoRegistro === EstadoRegistro.ACTIVO;

    if (inactivar && lista.esPredeterminada) {
      throw listaPredeterminadaRequerida();
    }

    return this.dataSource.transaction(async (manager) => {
      if (marcarPredeterminada) {
        await manager.update(
          ListaPrecio,
          {
            organizacionId: ctx.organizacionId!,
            esPredeterminada: true,
          },
          { esPredeterminada: false, updatedById: ctx.usuarioId },
        );
        lista.esPredeterminada = true;
      } else if (input.esPredeterminada === false && lista.esPredeterminada) {
        throw listaPredeterminadaRequerida();
      }

      if (input.estadoRegistro === 'INACTIVO') {
        lista.estadoRegistro = EstadoRegistro.INACTIVO;
      } else if (input.estadoRegistro === 'ACTIVO') {
        lista.estadoRegistro = EstadoRegistro.ACTIVO;
      }

      lista.updatedById = ctx.usuarioId;
      await manager.save(ListaPrecio, lista);

      if (lista.esPredeterminada && lista.estadoRegistro === EstadoRegistro.ACTIVO) {
        await manager.update(
          ConfiguracionCotizacion,
          { organizacionId: ctx.organizacionId! },
          {
            listaPrecioPredeterminadaId: lista.id,
            updatedById: ctx.usuarioId,
          },
        );
      }

      return mapListaPrecio(lista);
    });
  }

  async listarPrecios(ctx: OrgContext, listaId: string, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_LISTAS_VER);

    await this.buscarLista(ctx.organizacionId!, listaId);
    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);

    const qb = this.precioRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.item', 'item')
      .where('p.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      })
      .andWhere('p.listaPrecioId = :listaId', { listaId });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('p.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere(
        '(item.sku ILIKE :search OR item.nombre ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('item.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((p) => ({
        ...mapPrecioItem(p),
        item: p.item
          ? {
              id: p.item.id,
              sku: p.item.sku,
              nombre: p.item.nombre,
              estadoRegistro: p.item.estadoRegistro,
            }
          : null,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async upsertPrecio(ctx: OrgContext, listaId: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_LISTAS_ADMINISTRAR);

    const input = upsertPrecioSchema.parse(body);
    const lista = await this.buscarLista(ctx.organizacionId!, listaId);

    if (
      input.estadoRegistro !== 'INACTIVO' &&
      lista.estadoRegistro !== EstadoRegistro.ACTIVO
    ) {
      throw listaInactiva();
    }

    const item = await this.itemRepo.findOne({
      where: { id: input.itemId, organizacionId: ctx.organizacionId! },
    });
    if (!item) throw itemNoEncontrado();

    if (
      input.estadoRegistro !== 'INACTIVO' &&
      item.estadoRegistro !== EstadoRegistro.ACTIVO
    ) {
      throw precioItemInactivo();
    }

    const precioNormalizado = formatImporte(input.precio);
    let precio = await this.precioRepo.findOne({
      where: {
        listaPrecioId: listaId,
        itemId: input.itemId,
        organizacionId: ctx.organizacionId!,
      },
    });

    if (!precio) {
      precio = this.precioRepo.create({
        organizacionId: ctx.organizacionId!,
        listaPrecioId: listaId,
        itemId: input.itemId,
        precio: precioNormalizado,
        estadoRegistro:
          input.estadoRegistro === 'INACTIVO'
            ? EstadoRegistro.INACTIVO
            : EstadoRegistro.ACTIVO,
        createdById: ctx.usuarioId,
        updatedById: ctx.usuarioId,
      });
    } else {
      precio.precio = precioNormalizado;
      if (input.estadoRegistro === 'INACTIVO') {
        precio.estadoRegistro = EstadoRegistro.INACTIVO;
      } else if (input.estadoRegistro === 'ACTIVO' || input.estadoRegistro === undefined) {
        precio.estadoRegistro = EstadoRegistro.ACTIVO;
      }
      precio.updatedById = ctx.usuarioId;
    }

    await this.precioRepo.save(precio);
    return mapPrecioItem(precio);
  }

  private async buscarLista(
    organizacionId: string,
    id: string,
  ): Promise<ListaPrecio> {
    const lista = await this.listaRepo.findOne({
      where: { id, organizacionId },
    });
    if (!lista) throw listaNoEncontrada();
    return lista;
  }

  private async asegurarCodigoUnico(
    organizacionId: string,
    codigo: string,
    excludeId?: string,
  ) {
    const existente = await this.listaRepo.findOne({
      where: { organizacionId, codigo },
    });
    if (existente && existente.id !== excludeId) {
      throw listaCodigoDuplicado();
    }
  }

  private async validarMonedaBase(organizacionId: string, monedaId: string) {
    const org = await this.orgRepo.findOne({ where: { id: organizacionId } });
    if (!org) throw listaNoEncontrada();

    if (monedaId !== org.monedaBaseId) {
      throw listaMonedaDistintaDeBase();
    }

    const moneda = await this.monedaRepo.findOne({ where: { id: monedaId } });
    if (!moneda || moneda.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw listaMonedaInactiva();
    }
  }
}
