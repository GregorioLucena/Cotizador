import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AmbitoReglaDescuento,
  Categoria,
  EstadoRegistro,
  Item,
  ListaPrecio,
  Marca,
  ReglaDescuento,
  TipoDescuento,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearReglaDescuentoSchema,
  editarReglaDescuentoSchema,
  formatImporte,
  listaNoEncontrada,
  listQuerySchema,
  reglaAmbitoInvalido,
  reglaCantidadInvalida,
  reglaNoEncontrada,
  reglaReferenciaRequerida,
  reglaValorInvalido,
  reglaVigenciaInvalida,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { Repository } from 'typeorm';
import { mapReglaDescuento } from './precios.mapper';

@Injectable()
export class ReglasDescuentoService {
  constructor(
    @InjectRepository(ReglaDescuento)
    private readonly reglaRepo: Repository<ReglaDescuento>,
    @InjectRepository(ListaPrecio)
    private readonly listaRepo: Repository<ListaPrecio>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Marca)
    private readonly marcaRepo: Repository<Marca>,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_REGLAS_ADMINISTRAR);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);
    const qb = this.reglaRepo
      .createQueryBuilder('r')
      .where('r.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('r.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere('r.nombre ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('r.prioridad', 'DESC')
      .addOrderBy('r.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapReglaDescuento),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_REGLAS_ADMINISTRAR);

    const input = crearReglaDescuentoSchema.parse(body);
    await this.validarReferencias(ctx.organizacionId!, input);

    const regla = this.reglaRepo.create({
      organizacionId: ctx.organizacionId!,
      listaPrecioId: input.listaPrecioId ?? null,
      nombre: input.nombre,
      ambito: input.ambito as AmbitoReglaDescuento,
      referenciaId: input.ambito === 'GLOBAL' ? null : (input.referenciaId ?? null),
      cantidadMinima: formatImporte(input.cantidadMinima ?? '1.0000'),
      cantidadMaxima:
        input.cantidadMaxima != null ? formatImporte(input.cantidadMaxima) : null,
      tipoDescuento: input.tipoDescuento as TipoDescuento,
      valor: formatImporte(input.valor),
      prioridad: input.prioridad,
      vigenciaDesde: input.vigenciaDesde ?? null,
      vigenciaHasta: input.vigenciaHasta ?? null,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    await this.reglaRepo.save(regla);
    return mapReglaDescuento(regla);
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_REGLAS_ADMINISTRAR);

    const input = editarReglaDescuentoSchema.parse(body);
    const regla = await this.buscar(ctx.organizacionId!, id);

    if (input.nombre !== undefined) regla.nombre = input.nombre;
    if (input.listaPrecioId !== undefined) {
      if (input.listaPrecioId) {
        await this.asegurarLista(ctx.organizacionId!, input.listaPrecioId);
      }
      regla.listaPrecioId = input.listaPrecioId;
    }
    if (input.ambito !== undefined) {
      regla.ambito = input.ambito as AmbitoReglaDescuento;
    }
    if (input.referenciaId !== undefined) {
      regla.referenciaId = input.referenciaId;
    }
    if (input.cantidadMinima !== undefined) {
      regla.cantidadMinima = formatImporte(input.cantidadMinima);
    }
    if (input.cantidadMaxima !== undefined) {
      regla.cantidadMaxima =
        input.cantidadMaxima != null ? formatImporte(input.cantidadMaxima) : null;
    }
    if (input.tipoDescuento !== undefined) {
      regla.tipoDescuento = input.tipoDescuento as TipoDescuento;
    }
    if (input.valor !== undefined) {
      this.validarValor(regla.tipoDescuento, input.valor);
      regla.valor = formatImporte(input.valor);
    }
    if (input.prioridad !== undefined) regla.prioridad = input.prioridad;
    if (input.vigenciaDesde !== undefined) {
      regla.vigenciaDesde = input.vigenciaDesde;
    }
    if (input.vigenciaHasta !== undefined) {
      regla.vigenciaHasta = input.vigenciaHasta;
    }
    if (input.estadoRegistro === 'INACTIVO') {
      regla.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      regla.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    const ambito = regla.ambito;
    if (ambito === AmbitoReglaDescuento.GLOBAL) {
      regla.referenciaId = null;
    } else if (!regla.referenciaId) {
      throw reglaReferenciaRequerida();
    }

    if (
      regla.cantidadMaxima != null &&
      Number(regla.cantidadMaxima) < Number(regla.cantidadMinima)
    ) {
      throw reglaCantidadInvalida();
    }
    if (
      regla.vigenciaDesde &&
      regla.vigenciaHasta &&
      regla.vigenciaHasta < regla.vigenciaDesde
    ) {
      throw reglaVigenciaInvalida();
    }

    await this.validarReferencias(ctx.organizacionId!, {
      ambito: regla.ambito,
      referenciaId: regla.referenciaId ?? undefined,
      listaPrecioId: regla.listaPrecioId,
      tipoDescuento: regla.tipoDescuento,
      valor: regla.valor,
    });

    regla.updatedById = ctx.usuarioId;
    await this.reglaRepo.save(regla);
    return mapReglaDescuento(regla);
  }

  private async buscar(organizacionId: string, id: string): Promise<ReglaDescuento> {
    const regla = await this.reglaRepo.findOne({
      where: { id, organizacionId },
    });
    if (!regla) throw reglaNoEncontrada();
    return regla;
  }

  private async asegurarLista(organizacionId: string, listaId: string) {
    const lista = await this.listaRepo.findOne({
      where: { id: listaId, organizacionId },
    });
    if (!lista) throw listaNoEncontrada();
  }

  private validarValor(tipo: TipoDescuento | string, valor: string) {
    const n = Number(valor);
    if (Number.isNaN(n)) throw reglaValorInvalido();
    if (tipo === 'PORCENTAJE') {
      if (n < 0 || n > 100) throw reglaValorInvalido();
    } else if (n <= 0) {
      throw reglaValorInvalido();
    }
  }

  private async validarReferencias(
    organizacionId: string,
    input: {
      ambito: string;
      referenciaId?: string | null;
      listaPrecioId?: string | null;
      tipoDescuento: string;
      valor: string;
    },
  ) {
    this.validarValor(input.tipoDescuento, input.valor);

    if (input.listaPrecioId) {
      await this.asegurarLista(organizacionId, input.listaPrecioId);
    }

    if (input.ambito === 'GLOBAL') return;

    if (!input.referenciaId) throw reglaReferenciaRequerida();

    if (input.ambito === 'ITEM') {
      const item = await this.itemRepo.findOne({
        where: { id: input.referenciaId, organizacionId },
      });
      if (!item) throw reglaAmbitoInvalido();
    } else if (input.ambito === 'CATEGORIA') {
      const cat = await this.categoriaRepo.findOne({
        where: { id: input.referenciaId, organizacionId },
      });
      if (!cat) throw reglaAmbitoInvalido();
    } else if (input.ambito === 'MARCA') {
      const marca = await this.marcaRepo.findOne({
        where: { id: input.referenciaId, organizacionId },
      });
      if (!marca) throw reglaAmbitoInvalido();
    }
  }
}
