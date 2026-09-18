import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import {
  AmbitoPerfil,
  EstadoRegistro,
  Perfil,
  Sucursal,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
  Sesion,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  requireOrganizacionContext,
  requirePermission,
  listQuerySchema,
  crearUsuarioSchema,
  editarUsuarioSchema,
  restablecerPasswordSchema,
  usuarioNoEncontrado,
  usuarioEmailDuplicado,
  usuarioSinPerfil,
  usuarioSinSucursal,
  perfilAmbitoIncompatible,
  autogestionPerfilesProhibida,
  autoinactivacionProhibida,
  ultimoAdministrador,
  generarPasswordTemporal,
  validarPoliticaPassword,
  NotFoundError,
  BusinessRuleError,
  sucursalInactiva,
} from '@cotizador/shared';

const BCRYPT_ROUNDS = 12;
const CODIGO_ADMIN_ORG = 'ADMINISTRADOR_ORGANIZACION';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(UsuarioPerfil)
    private readonly usuarioPerfilRepo: Repository<UsuarioPerfil>,
    @InjectRepository(UsuarioSucursal)
    private readonly usuarioSucursalRepo: Repository<UsuarioSucursal>,
    @InjectRepository(Perfil)
    private readonly perfilRepo: Repository<Perfil>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.SEGURIDAD_USUARIOS_VER);

    const { page, limit, search, estadoRegistro } = listQuerySchema.parse(query);

    const qb = this.usuarioRepo
      .createQueryBuilder('u')
      .where('u.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('u.estadoRegistro = :estado', { estado: estadoRegistro });
    }

    if (search) {
      qb.andWhere(
        '(u.nombreCompleto ILIKE :search OR u.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('u.nombreCompleto', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [usuarios, total] = await qb.getManyAndCount();
    const items = await Promise.all(
      usuarios.map((u) => this.mapUsuarioDetalle(u)),
    );

    return {
      items,
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
    requirePermission(ctx, PERMISOS.SEGURIDAD_USUARIOS_VER);

    const usuario = await this.buscarEnOrganizacion(ctx.organizacionId, id);
    return this.mapUsuarioDetalle(usuario);
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.SEGURIDAD_USUARIOS_CREAR);

    const input = crearUsuarioSchema.parse(body);

    const existente = await this.usuarioRepo.findOne({
      where: { email: input.email },
    });
    if (existente) {
      throw usuarioEmailDuplicado();
    }

    const perfiles = await this.validarPerfilesOrganizacion(input.perfilIds);
    await this.validarSucursalesOrganizacion(ctx.organizacionId, input.sucursalIds);

    const passwordTemporal =
      input.passwordTemporal ??
      this.passwordTemporalPara({
        email: input.email,
        nombreCompleto: input.nombreCompleto,
      });

    validarPoliticaPassword(passwordTemporal, {
      email: input.email,
      nombreCompleto: input.nombreCompleto,
    });

    const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);

    const usuarioId = await this.dataSource.transaction(async (manager) => {
      const usuario = manager.create(Usuario, {
        organizacionId: ctx.organizacionId,
        nombreCompleto: input.nombreCompleto,
        email: input.email,
        telefono: input.telefono ?? null,
        passwordHash,
        debeCambiarPassword: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
        createdById: ctx.usuarioId,
        updatedById: ctx.usuarioId,
      });
      const guardado = await manager.save(usuario);

      await manager.save(
        UsuarioPerfil,
        perfiles.map((p) =>
          manager.create(UsuarioPerfil, {
            usuarioId: guardado.id,
            perfilId: p.id,
          }),
        ),
      );

      await manager.save(
        UsuarioSucursal,
        input.sucursalIds.map((sucursalId) =>
          manager.create(UsuarioSucursal, {
            usuarioId: guardado.id,
            sucursalId,
          }),
        ),
      );

      return guardado.id;
    });

    return {
      usuarioId,
      email: input.email,
      passwordTemporal,
      debeCambiarPassword: true as const,
    };
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.SEGURIDAD_USUARIOS_EDITAR);

    const input = editarUsuarioSchema.parse(body);
    const usuario = await this.buscarEnOrganizacion(ctx.organizacionId, id);

    if (input.perfilIds !== undefined && id === ctx.usuarioId) {
      throw autogestionPerfilesProhibida();
    }

    if (
      input.estadoRegistro === EstadoRegistro.INACTIVO &&
      id === ctx.usuarioId
    ) {
      throw autoinactivacionProhibida();
    }

    const perfilesActuales = await this.usuarioPerfilRepo.find({
      where: { usuarioId: id },
    });
    const sucursalesActuales = await this.usuarioSucursalRepo.find({
      where: { usuarioId: id },
    });

    const perfilIdsResultantes =
      input.perfilIds ?? perfilesActuales.map((p) => p.perfilId);
    const sucursalIdsResultantes =
      input.sucursalIds ?? sucursalesActuales.map((s) => s.sucursalId);
    const estadoResultante = (input.estadoRegistro ??
      usuario.estadoRegistro) as EstadoRegistro;

    if (perfilIdsResultantes.length === 0) {
      throw usuarioSinPerfil();
    }
    if (sucursalIdsResultantes.length === 0) {
      throw usuarioSinSucursal();
    }

    if (input.perfilIds) {
      await this.validarPerfilesOrganizacion(input.perfilIds);
    }
    if (input.sucursalIds) {
      await this.validarSucursalesOrganizacion(
        ctx.organizacionId,
        input.sucursalIds,
      );
    }

    await this.asegurarQuedaAdministrador(
      ctx.organizacionId,
      id,
      perfilIdsResultantes,
      estadoResultante,
    );

    await this.dataSource.transaction(async (manager) => {
      if (input.nombreCompleto !== undefined) {
        usuario.nombreCompleto = input.nombreCompleto;
      }
      if (input.telefono !== undefined) {
        usuario.telefono = input.telefono;
      }
      if (input.estadoRegistro !== undefined) {
        usuario.estadoRegistro = input.estadoRegistro as EstadoRegistro;
      }
      usuario.updatedById = ctx.usuarioId;
      await manager.save(usuario);

      if (input.perfilIds) {
        await manager.delete(UsuarioPerfil, { usuarioId: id });
        await manager.save(
          UsuarioPerfil,
          input.perfilIds.map((perfilId) =>
            manager.create(UsuarioPerfil, { usuarioId: id, perfilId }),
          ),
        );
      }

      if (input.sucursalIds) {
        await manager.delete(UsuarioSucursal, { usuarioId: id });
        await manager.save(
          UsuarioSucursal,
          input.sucursalIds.map((sucursalId) =>
            manager.create(UsuarioSucursal, { usuarioId: id, sucursalId }),
          ),
        );
      }

      if (estadoResultante === EstadoRegistro.INACTIVO) {
        await manager.update(
          Sesion,
          { usuarioId: id, revocadaAt: IsNull() },
          { revocadaAt: new Date() },
        );
      }
    });

    const actualizado = await this.buscarEnOrganizacion(ctx.organizacionId, id);
    return this.mapUsuarioDetalle(actualizado);
  }

  async restablecerPassword(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.SEGURIDAD_USUARIOS_RESTABLECER_CLAVE);

    if (id === ctx.usuarioId) {
      throw new BusinessRuleError(
        'OPERACION_NO_PERMITIDA_EN_ESTADO',
        'No puede restablecer su propia contraseña. Use el cambio de contraseña.',
      );
    }

    const input = restablecerPasswordSchema.parse(body);
    const usuario = await this.buscarEnOrganizacion(ctx.organizacionId, id);

    const passwordTemporal =
      input.passwordTemporal ??
      this.passwordTemporalPara({
        email: usuario.email,
        nombreCompleto: usuario.nombreCompleto,
      });

    validarPoliticaPassword(passwordTemporal, {
      email: usuario.email,
      nombreCompleto: usuario.nombreCompleto,
    });

    usuario.passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);
    usuario.debeCambiarPassword = true;
    usuario.updatedById = ctx.usuarioId;
    await this.usuarioRepo.save(usuario);

    const result = await this.sesionRepo.update(
      { usuarioId: id, revocadaAt: IsNull() },
      { revocadaAt: new Date() },
    );

    return {
      passwordTemporal,
      sesionesRevocadas: result.affected ?? 0,
    };
  }

  async listarPerfiles(ctx: OrgContext) {
    requirePermission(ctx, PERMISOS.SEGURIDAD_USUARIOS_VER);

    const ambito =
      ctx.ambito === 'PLATAFORMA'
        ? AmbitoPerfil.PLATAFORMA
        : AmbitoPerfil.ORGANIZACION;

    const perfiles = await this.perfilRepo.find({
      where: {
        ambito,
        estadoRegistro: EstadoRegistro.ACTIVO,
      },
      order: { nombre: 'ASC' },
    });

    return perfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      ambito: p.ambito,
      descripcion: p.descripcion ?? null,
      esSistema: p.esSistema,
    }));
  }

  private async buscarEnOrganizacion(
    organizacionId: string,
    id: string,
  ): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({
      where: { id, organizacionId },
    });
    if (!usuario) {
      throw usuarioNoEncontrado();
    }
    return usuario;
  }

  private async validarPerfilesOrganizacion(perfilIds: string[]): Promise<Perfil[]> {
    const perfiles = await this.perfilRepo.find({
      where: { id: In(perfilIds) },
    });
    if (perfiles.length !== perfilIds.length) {
      throw new NotFoundError();
    }
    for (const perfil of perfiles) {
      if (perfil.ambito !== AmbitoPerfil.ORGANIZACION) {
        throw perfilAmbitoIncompatible();
      }
      if (perfil.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw new NotFoundError();
      }
    }
    return perfiles;
  }

  private async validarSucursalesOrganizacion(
    organizacionId: string,
    sucursalIds: string[],
  ): Promise<void> {
    const sucursales = await this.sucursalRepo.find({
      where: { id: In(sucursalIds) },
    });
    if (sucursales.length !== sucursalIds.length) {
      throw new NotFoundError();
    }
    for (const sucursal of sucursales) {
      if (sucursal.organizacionId !== organizacionId) {
        throw new NotFoundError();
      }
      if (sucursal.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw sucursalInactiva();
      }
    }
  }

  private async asegurarQuedaAdministrador(
    organizacionId: string,
    usuarioId: string,
    perfilIdsResultantes: string[],
    estadoResultante: EstadoRegistro,
  ): Promise<void> {
    const adminPerfil = await this.perfilRepo.findOne({
      where: { codigo: CODIGO_ADMIN_ORG },
    });
    if (!adminPerfil) {
      return;
    }

    const seraAdmin =
      estadoResultante === EstadoRegistro.ACTIVO &&
      perfilIdsResultantes.includes(adminPerfil.id);

    const otros = await this.usuarioRepo
      .createQueryBuilder('u')
      .innerJoin(UsuarioPerfil, 'up', 'up.usuarioId = u.id')
      .where('u.organizacionId = :organizacionId', { organizacionId })
      .andWhere('u.estadoRegistro = :activo', { activo: EstadoRegistro.ACTIVO })
      .andWhere('up.perfilId = :perfilId', { perfilId: adminPerfil.id })
      .andWhere('u.id != :usuarioId', { usuarioId })
      .getCount();

    if (otros + (seraAdmin ? 1 : 0) < 1) {
      throw ultimoAdministrador();
    }
  }

  private passwordTemporalPara(ctx: {
    email: string;
    nombreCompleto: string;
  }): string {
    let password = generarPasswordTemporal();
    try {
      validarPoliticaPassword(password, ctx);
    } catch {
      password = generarPasswordTemporal();
      validarPoliticaPassword(password, ctx);
    }
    return password;
  }

  private async mapUsuarioDetalle(usuario: Usuario) {
    const [perfilesAsig, sucursalesAsig] = await Promise.all([
      this.usuarioPerfilRepo.find({
        where: { usuarioId: usuario.id },
        relations: { perfil: true },
      }),
      this.usuarioSucursalRepo.find({
        where: { usuarioId: usuario.id },
        relations: { sucursal: true },
      }),
    ]);

    return {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      email: usuario.email,
      telefono: usuario.telefono ?? null,
      debeCambiarPassword: usuario.debeCambiarPassword,
      ultimoAccesoAt: usuario.ultimoAccesoAt ?? null,
      estadoRegistro: usuario.estadoRegistro,
      perfiles: perfilesAsig.map((a) => ({
        id: a.perfil.id,
        nombre: a.perfil.nombre,
        codigo: a.perfil.codigo,
      })),
      sucursales: sucursalesAsig.map((a) => ({
        id: a.sucursal.id,
        nombre: a.sucursal.nombre,
        esPrincipal: a.sucursal.esPrincipal,
      })),
    };
  }
}
