import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Categoria, EstadoRegistro } from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  categoriasListQuerySchema,
  categoriaNoEncontrada,
  categoriaNombreDuplicado,
  categoriaPadreInvalido,
  categoriaProfundidadExcedida,
  crearCategoriaSchema,
  editarCategoriaSchema,
  maestraEnUso,
  normalizarNombreComparacion,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ItemsUsoHelper } from './items-uso.helper';
import { mapCategoria } from './maestras.mapper';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    private readonly itemsUso: ItemsUsoHelper,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_VER);

    const { page, limit, search, estadoRegistro, soloRaices, padreId } =
      categoriasListQuerySchema.parse(query);

    const qb = this.categoriaRepo
      .createQueryBuilder('c')
      .where('c.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('c.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (soloRaices) {
      qb.andWhere('c.categoriaPadreId IS NULL');
    }
    if (padreId) {
      qb.andWhere('c.categoriaPadreId = :padreId', { padreId });
    }
    if (search) {
      qb.andWhere('c.nombre ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('c.orden', 'ASC')
      .addOrderBy('c.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapCategoria),
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

    const input = crearCategoriaSchema.parse(body);
    const padreId = input.categoriaPadreId ?? null;

    if (padreId) {
      await this.validarPadre(ctx.organizacionId!, padreId);
    }

    await this.asegurarNombreUnico(
      ctx.organizacionId!,
      input.nombre,
      padreId,
    );

    const orden =
      input.orden ??
      (await this.siguienteOrden(ctx.organizacionId!, padreId));

    const categoria = this.categoriaRepo.create({
      organizacionId: ctx.organizacionId!,
      nombre: input.nombre,
      categoriaPadreId: padreId,
      orden,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.categoriaRepo.save(categoria);
    return mapCategoria(categoria);
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR);

    const input = editarCategoriaSchema.parse(body);
    const categoria = await this.buscar(ctx.organizacionId!, id);

    const nombreAnterior = categoria.nombre;
    let regenerarTexto = false;

    if (input.categoriaPadreId !== undefined) {
      const nuevoPadreId = input.categoriaPadreId;
      if (nuevoPadreId !== (categoria.categoriaPadreId ?? null)) {
        if (nuevoPadreId) {
          if (nuevoPadreId === id) {
            throw categoriaPadreInvalido();
          }
          await this.validarPadre(ctx.organizacionId!, nuevoPadreId);
          // No se puede convertir en subcategoría una raíz que ya tiene hijas.
          const hijas = await this.categoriaRepo.count({
            where: { organizacionId: ctx.organizacionId!, categoriaPadreId: id },
          });
          if (hijas > 0) {
            throw categoriaProfundidadExcedida();
          }
        }
        categoria.categoriaPadreId = nuevoPadreId;
      }
    }

    if (input.nombre !== undefined) {
      const padreId = categoria.categoriaPadreId ?? null;
      if (
        normalizarNombreComparacion(input.nombre) !==
        normalizarNombreComparacion(categoria.nombre)
      ) {
        await this.asegurarNombreUnico(
          ctx.organizacionId!,
          input.nombre,
          padreId,
          id,
        );
        categoria.nombre = input.nombre;
        if (input.nombre !== nombreAnterior) {
          regenerarTexto = true;
        }
      } else if (input.nombre !== categoria.nombre) {
        // Solo cambia mayúsculas/acentos: actualizar y regenerar.
        categoria.nombre = input.nombre;
        regenerarTexto = true;
      }
    }

    if (input.orden !== undefined) {
      categoria.orden = input.orden;
    }

    if (
      input.estadoRegistro === 'INACTIVO' &&
      categoria.estadoRegistro === EstadoRegistro.ACTIVO
    ) {
      const itemsActivos = await this.itemsUso.contarActivosPorCategoria(
        ctx.organizacionId!,
        id,
      );
      if (itemsActivos > 0) {
        const subcategoriasActivas =
          await this.itemsUso.contarSubcategoriasActivas(
            ctx.organizacionId!,
            id,
          );
        throw maestraEnUso({
          tipo: 'categoria',
          id,
          itemsActivos,
          ...(subcategoriasActivas > 0 ? { subcategoriasActivas } : {}),
        });
      }
      categoria.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      categoria.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    // Si se movió de padre, revalidar unicidad bajo el padre final.
    if (input.categoriaPadreId !== undefined && input.nombre === undefined) {
      await this.asegurarNombreUnico(
        ctx.organizacionId!,
        categoria.nombre,
        categoria.categoriaPadreId ?? null,
        id,
      );
    }

    categoria.updatedById = ctx.usuarioId;

    if (regenerarTexto) {
      return this.dataSource.transaction(async (manager) => {
        await manager.save(Categoria, categoria);
        await this.itemsUso.regenerarTextoPorCategoria(
          manager,
          ctx.organizacionId!,
          id,
        );
        return mapCategoria(categoria);
      });
    }

    await this.categoriaRepo.save(categoria);
    return mapCategoria(categoria);
  }

  private async buscar(
    organizacionId: string,
    id: string,
  ): Promise<Categoria> {
    const categoria = await this.categoriaRepo.findOne({
      where: { id, organizacionId },
    });
    if (!categoria) throw categoriaNoEncontrada();
    return categoria;
  }

  private async validarPadre(
    organizacionId: string,
    padreId: string,
  ): Promise<void> {
    const padre = await this.categoriaRepo.findOne({
      where: { id: padreId, organizacionId },
    });
    if (!padre) throw categoriaNoEncontrada();
    if (padre.categoriaPadreId) {
      throw categoriaProfundidadExcedida();
    }
    if (padre.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw categoriaPadreInvalido();
    }
  }

  private async asegurarNombreUnico(
    organizacionId: string,
    nombre: string,
    categoriaPadreId: string | null,
    excluirId?: string,
  ) {
    const hermanas = await this.categoriaRepo.find({
      where:
        categoriaPadreId === null
          ? { organizacionId, categoriaPadreId: IsNull() }
          : { organizacionId, categoriaPadreId },
    });
    const clave = normalizarNombreComparacion(nombre);
    const existe = hermanas.some(
      (c) =>
        c.id !== excluirId &&
        normalizarNombreComparacion(c.nombre) === clave,
    );
    if (existe) throw categoriaNombreDuplicado();
  }

  private async siguienteOrden(
    organizacionId: string,
    categoriaPadreId: string | null,
  ): Promise<number> {
    const qb = this.categoriaRepo
      .createQueryBuilder('c')
      .select('COALESCE(MAX(c.orden), -1)', 'max')
      .where('c.organizacionId = :organizacionId', { organizacionId });

    if (categoriaPadreId === null) {
      qb.andWhere('c.categoriaPadreId IS NULL');
    } else {
      qb.andWhere('c.categoriaPadreId = :categoriaPadreId', {
        categoriaPadreId,
      });
    }

    const raw = await qb.getRawOne<{ max: string }>();
    return Number(raw?.max ?? -1) + 1;
  }
}
