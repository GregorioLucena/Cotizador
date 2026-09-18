import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EstadoRegistro, Marca } from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearMarcaSchema,
  editarMarcaSchema,
  listQuerySchema,
  maestraEnUso,
  marcaNoEncontrada,
  marcaNombreDuplicado,
  normalizarNombreComparacion,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { DataSource, Repository } from 'typeorm';
import { ItemsUsoHelper } from './items-uso.helper';
import { mapMarca } from './maestras.mapper';

@Injectable()
export class MarcasService {
  constructor(
    @InjectRepository(Marca)
    private readonly marcaRepo: Repository<Marca>,
    private readonly itemsUso: ItemsUsoHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_VER);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);
    const qb = this.marcaRepo
      .createQueryBuilder('m')
      .where('m.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('m.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere('m.nombre ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('m.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapMarca),
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

    const input = crearMarcaSchema.parse(body);
    await this.asegurarNombreUnico(ctx.organizacionId!, input.nombre);

    const marca = this.marcaRepo.create({
      organizacionId: ctx.organizacionId!,
      nombre: input.nombre,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.marcaRepo.save(marca);
    return mapMarca(marca);
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

    const input = editarMarcaSchema.parse(body);
    const marca = await this.buscar(ctx.organizacionId!, id);
    let regenerarTexto = false;

    if (input.nombre !== undefined) {
      const mismoComparacion =
        normalizarNombreComparacion(input.nombre) ===
        normalizarNombreComparacion(marca.nombre);
      if (!mismoComparacion) {
        await this.asegurarNombreUnico(ctx.organizacionId!, input.nombre, id);
      }
      if (input.nombre !== marca.nombre) {
        marca.nombre = input.nombre;
        regenerarTexto = true;
      }
    }

    if (
      input.estadoRegistro === 'INACTIVO' &&
      marca.estadoRegistro === EstadoRegistro.ACTIVO
    ) {
      const itemsActivos = await this.itemsUso.contarActivosPorMarca(
        ctx.organizacionId!,
        id,
      );
      if (itemsActivos > 0) {
        throw maestraEnUso({
          tipo: 'marca',
          id,
          itemsActivos,
        });
      }
      marca.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      marca.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    marca.updatedById = ctx.usuarioId;

    if (regenerarTexto) {
      return this.dataSource.transaction(async (manager) => {
        await manager.save(Marca, marca);
        await this.itemsUso.regenerarTextoPorMarca(
          manager,
          ctx.organizacionId!,
          id,
        );
        return mapMarca(marca);
      });
    }

    await this.marcaRepo.save(marca);
    return mapMarca(marca);
  }

  private async buscar(organizacionId: string, id: string): Promise<Marca> {
    const marca = await this.marcaRepo.findOne({
      where: { id, organizacionId },
    });
    if (!marca) throw marcaNoEncontrada();
    return marca;
  }

  private async asegurarNombreUnico(
    organizacionId: string,
    nombre: string,
    excluirId?: string,
  ) {
    const marcas = await this.marcaRepo.find({ where: { organizacionId } });
    const clave = normalizarNombreComparacion(nombre);
    const existe = marcas.some(
      (m) =>
        m.id !== excluirId &&
        normalizarNombreComparacion(m.nombre) === clave,
    );
    if (existe) throw marcaNombreDuplicado();
  }
}
