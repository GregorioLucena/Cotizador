import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EstadoRegistro, UnidadMedida } from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearUnidadMedidaSchema,
  editarUnidadMedidaSchema,
  listQuerySchema,
  maestraEnUso,
  normalizarCodigoUnidad,
  requireOrganizacionContext,
  requirePermission,
  unidadMedidaCodigoDuplicado,
  unidadMedidaNoEncontrada,
} from '@cotizador/shared';
import { Not, Repository } from 'typeorm';
import { ItemsUsoHelper } from './items-uso.helper';
import { mapUnidadMedida } from './maestras.mapper';

@Injectable()
export class UnidadesMedidaService {
  constructor(
    @InjectRepository(UnidadMedida)
    private readonly unidadRepo: Repository<UnidadMedida>,
    private readonly itemsUso: ItemsUsoHelper,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_VER);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);
    const qb = this.unidadRepo
      .createQueryBuilder('u')
      .where('u.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('u.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere('(u.codigo ILIKE :search OR u.nombre ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('u.codigo', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapUnidadMedida),
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
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

    const input = crearUnidadMedidaSchema.parse(body);
    const codigo = normalizarCodigoUnidad(input.codigo);
    await this.asegurarCodigoUnico(ctx.organizacionId!, codigo);

    const unidad = this.unidadRepo.create({
      organizacionId: ctx.organizacionId!,
      codigo,
      nombre: input.nombre,
      permiteDecimales: input.permiteDecimales,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.unidadRepo.save(unidad);
    return mapUnidadMedida(unidad);
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

    const input = editarUnidadMedidaSchema.parse(body);
    const unidad = await this.buscar(ctx.organizacionId!, id);

    if (input.codigo !== undefined) {
      const codigo = normalizarCodigoUnidad(input.codigo);
      if (codigo !== unidad.codigo) {
        await this.asegurarCodigoUnico(ctx.organizacionId!, codigo, id);
        unidad.codigo = codigo;
      }
    }
    if (input.nombre !== undefined) {
      unidad.nombre = input.nombre;
    }

    if (
      input.permiteDecimales !== undefined &&
      input.permiteDecimales !== unidad.permiteDecimales
    ) {
      const itemsActivos = await this.itemsUso.contarActivosPorUnidad(
        ctx.organizacionId!,
        id,
      );
      if (itemsActivos > 0) {
        throw maestraEnUso({
          tipo: 'unidad_medida',
          id,
          itemsActivos,
        });
      }
      unidad.permiteDecimales = input.permiteDecimales;
    }

    if (
      input.estadoRegistro === 'INACTIVO' &&
      unidad.estadoRegistro === EstadoRegistro.ACTIVO
    ) {
      const itemsActivos = await this.itemsUso.contarActivosPorUnidad(
        ctx.organizacionId!,
        id,
      );
      if (itemsActivos > 0) {
        throw maestraEnUso({
          tipo: 'unidad_medida',
          id,
          itemsActivos,
        });
      }
      unidad.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      unidad.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    unidad.updatedById = ctx.usuarioId;
    await this.unidadRepo.save(unidad);
    return mapUnidadMedida(unidad);
  }

  private async buscar(
    organizacionId: string,
    id: string,
  ): Promise<UnidadMedida> {
    const unidad = await this.unidadRepo.findOne({
      where: { id, organizacionId },
    });
    if (!unidad) throw unidadMedidaNoEncontrada();
    return unidad;
  }

  private async asegurarCodigoUnico(
    organizacionId: string,
    codigo: string,
    excluirId?: string,
  ) {
    const where = excluirId
      ? { organizacionId, codigo, id: Not(excluirId) }
      : { organizacionId, codigo };
    const existe = await this.unidadRepo.findOne({ where });
    if (existe) throw unidadMedidaCodigoDuplicado();
  }
}
