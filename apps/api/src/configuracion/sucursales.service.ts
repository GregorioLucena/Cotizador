import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  EstadoRegistro,
  Sucursal,
  UsuarioSucursal,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearSucursalSchema,
  editarSucursalSchema,
  listQuerySchema,
  organizacionSucursalCodigoDuplicado,
  organizacionSucursalEnUso,
  organizacionSucursalNoEncontrada,
  organizacionSucursalNombreDuplicado,
  organizacionSucursalPrincipalNoInactivable,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { mapSucursal } from './configuracion.mapper';

@Injectable()
export class SucursalesService {
  constructor(
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(UsuarioSucursal)
    private readonly usuarioSucursalRepo: Repository<UsuarioSucursal>,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_SUCURSALES_VER);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);
    const qb = this.sucursalRepo
      .createQueryBuilder('s')
      .where('s.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('s.estadoRegistro = :estado', { estado: estadoRegistro });
    }
    if (search) {
      qb.andWhere('(s.nombre ILIKE :search OR s.codigo ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('s.esPrincipal', 'DESC')
      .addOrderBy('s.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const mapped = await Promise.all(
      items.map(async (s) =>
        mapSucursal(s, await this.contarUsuarios(s.id)),
      ),
    );

    return {
      items: mapped,
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
    requirePermission(ctx, PERMISOS.CONFIGURACION_SUCURSALES_VER);
    const sucursal = await this.buscar(ctx.organizacionId, id);
    return mapSucursal(sucursal, await this.contarUsuarios(sucursal.id));
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_SUCURSALES_ADMINISTRAR);
    const input = crearSucursalSchema.parse(body);

    await this.asegurarNombreUnico(ctx.organizacionId, input.nombre);
    await this.asegurarCodigoUnico(ctx.organizacionId, input.codigo);

    const sucursal = this.sucursalRepo.create({
      organizacionId: ctx.organizacionId,
      nombre: input.nombre,
      codigo: input.codigo,
      direccion: input.direccion ?? null,
      telefono: input.telefono ?? null,
      esPrincipal: false,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.sucursalRepo.save(sucursal);
    return mapSucursal(sucursal, 0);
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_SUCURSALES_ADMINISTRAR);
    const input = editarSucursalSchema.parse(body);
    const sucursal = await this.buscar(ctx.organizacionId, id);

    if (input.nombre !== undefined && input.nombre !== sucursal.nombre) {
      await this.asegurarNombreUnico(ctx.organizacionId, input.nombre, id);
      sucursal.nombre = input.nombre;
    }
    if (input.codigo !== undefined && input.codigo !== sucursal.codigo) {
      await this.asegurarCodigoUnico(ctx.organizacionId, input.codigo, id);
      sucursal.codigo = input.codigo;
    }
    if (input.direccion !== undefined) sucursal.direccion = input.direccion;
    if (input.telefono !== undefined) sucursal.telefono = input.telefono;

    if (
      input.estadoRegistro === 'INACTIVO' &&
      sucursal.estadoRegistro === EstadoRegistro.ACTIVO
    ) {
      if (sucursal.esPrincipal) {
        throw organizacionSucursalPrincipalNoInactivable();
      }
      await this.asegurarNoDejaUsuariosSinSucursal(sucursal.id);
      sucursal.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      sucursal.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    sucursal.updatedById = ctx.usuarioId;
    await this.sucursalRepo.save(sucursal);
    return mapSucursal(sucursal, await this.contarUsuarios(sucursal.id));
  }

  private async buscar(organizacionId: string, id: string): Promise<Sucursal> {
    const sucursal = await this.sucursalRepo.findOne({
      where: { id, organizacionId },
    });
    if (!sucursal) throw organizacionSucursalNoEncontrada();
    return sucursal;
  }

  private async asegurarNombreUnico(
    organizacionId: string,
    nombre: string,
    excluirId?: string,
  ) {
    const where = excluirId
      ? { organizacionId, nombre, id: Not(excluirId) }
      : { organizacionId, nombre };
    const existe = await this.sucursalRepo.findOne({ where });
    if (existe) throw organizacionSucursalNombreDuplicado();
  }

  private async asegurarCodigoUnico(
    organizacionId: string,
    codigo: string,
    excluirId?: string,
  ) {
    const where = excluirId
      ? { organizacionId, codigo, id: Not(excluirId) }
      : { organizacionId, codigo };
    const existe = await this.sucursalRepo.findOne({ where });
    if (existe) throw organizacionSucursalCodigoDuplicado();
  }

  private async contarUsuarios(sucursalId: string): Promise<number> {
    return this.usuarioSucursalRepo.count({ where: { sucursalId } });
  }

  private async asegurarNoDejaUsuariosSinSucursal(sucursalId: string) {
    const asignados = await this.usuarioSucursalRepo.find({
      where: { sucursalId },
    });
    if (asignados.length === 0) return;

    const afectados: string[] = [];
    for (const a of asignados) {
      const otras = await this.usuarioSucursalRepo
        .createQueryBuilder('us')
        .innerJoin(Sucursal, 's', 's.id = us.sucursalId')
        .where('us.usuarioId = :usuarioId', { usuarioId: a.usuarioId })
        .andWhere('us.sucursalId != :sucursalId', { sucursalId })
        .andWhere('s.estadoRegistro = :activo', {
          activo: EstadoRegistro.ACTIVO,
        })
        .getCount();
      if (otras === 0) {
        afectados.push(a.usuarioId);
      }
    }
    if (afectados.length > 0) {
      throw organizacionSucursalEnUso({ usuarioIds: afectados });
    }
  }
}
