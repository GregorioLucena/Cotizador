import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import {
  Categoria,
  DefinicionAtributo,
  EstadoRegistro,
  ListaPrecio,
  Moneda,
  Organizacion,
  PACK_VERSION,
  Perfil,
  PlantillaDocumento,
  Sesion,
  Sucursal,
  UnidadMedida,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
  Vertical,
  getPack,
  listarPacksResumen,
  packsPorCodigo,
  type CodigoVertical,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  requirePlataformaContext,
  requirePermission,
  listQuerySchema,
  crearOrganizacionSchema,
  editarOrganizacionSchema,
  crearUsuarioInicialSchema,
  metricasQuerySchema,
  organizacionNoEncontrada,
  organizacionNombreDuplicado,
  organizacionIdentificacionDuplicada,
  organizacionInactiva,
  organizacionPackNoDisponible,
  organizacionProvisionamientoFallido,
  organizacionVerticalNoModificable,
  organizacionYaTieneAdministrador,
  organizacionMonedaPresentacionIgualABase,
  organizacionUmbralesIncoherentes,
  verticalInactivo,
  monedaInactiva,
  usuarioEmailDuplicado,
  generarPasswordTemporal,
  validarPoliticaPassword,
  NotFoundError,
  AppError,
} from '@cotizador/shared';
import { ZodError } from 'zod';
import {
  mapOrganizacionDetalle,
  type OrganizacionDetalle,
} from './organizacion.mapper';
import { ProvisionamientoService } from './provisionamiento.service';

const BCRYPT_ROUNDS = 12;
const CODIGO_ADMIN_ORG = 'ADMINISTRADOR_ORGANIZACION';
const RELACIONES_ORG = {
  vertical: true,
  monedaBase: true,
  monedaPresentacion: true,
} as const;

@Injectable()
export class OrganizacionesService {
  constructor(
    @InjectRepository(Organizacion)
    private readonly organizacionRepo: Repository<Organizacion>,
    @InjectRepository(Vertical)
    private readonly verticalRepo: Repository<Vertical>,
    @InjectRepository(Moneda)
    private readonly monedaRepo: Repository<Moneda>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Perfil)
    private readonly perfilRepo: Repository<Perfil>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(UnidadMedida)
    private readonly unidadRepo: Repository<UnidadMedida>,
    @InjectRepository(DefinicionAtributo)
    private readonly definicionRepo: Repository<DefinicionAtributo>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(ListaPrecio)
    private readonly listaPrecioRepo: Repository<ListaPrecio>,
    @InjectRepository(PlantillaDocumento)
    private readonly plantillaRepo: Repository<PlantillaDocumento>,
    private readonly provisionamiento: ProvisionamientoService,
    private readonly dataSource: DataSource,
  ) {}

  async listarVerticales(_ctx: OrgContext) {
    const verticales = await this.verticalRepo.find({
      where: { estadoRegistro: EstadoRegistro.ACTIVO },
      order: { nombre: 'ASC' },
    });

    const resumenes = new Map(
      listarPacksResumen().map((r) => [r.codigo, r]),
    );

    return verticales.map((v) => ({
      id: v.id,
      codigo: v.codigo,
      nombre: v.nombre,
      descripcion: v.descripcion ?? null,
      estadoRegistro: v.estadoRegistro,
      pack: resumenes.get(v.codigo as CodigoVertical) ?? null,
    }));
  }

  async listarMonedas(_ctx: OrgContext) {
    const monedas = await this.monedaRepo.find({
      where: { estadoRegistro: EstadoRegistro.ACTIVO },
      order: { codigoIso: 'ASC' },
    });

    return monedas.map((m) => ({
      id: m.id,
      codigoIso: m.codigoIso,
      nombre: m.nombre,
      simbolo: m.simbolo,
      decimales: m.decimales,
      estadoRegistro: m.estadoRegistro,
    }));
  }

  async listar(ctx: OrgContext, query: unknown) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_ORGANIZACIONES_VER);

    const base = listQuerySchema.parse(query);
    const verticalId =
      typeof query === 'object' &&
      query !== null &&
      'verticalId' in query &&
      typeof (query as { verticalId?: unknown }).verticalId === 'string' &&
      (query as { verticalId: string }).verticalId.length > 0
        ? (query as { verticalId: string }).verticalId
        : undefined;

    const qb = this.organizacionRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.vertical', 'vertical')
      .leftJoinAndSelect('o.monedaBase', 'monedaBase')
      .leftJoinAndSelect('o.monedaPresentacion', 'monedaPresentacion');

    if (base.estadoRegistro !== 'TODOS') {
      qb.andWhere('o.estadoRegistro = :estado', { estado: base.estadoRegistro });
    }

    if (verticalId) {
      qb.andWhere('o.verticalId = :verticalId', { verticalId });
    }

    if (base.search) {
      qb.andWhere(
        '(o.nombre ILIKE :search OR o.identificacionFiscal ILIKE :search)',
        { search: `%${base.search}%` },
      );
    }

    qb.orderBy('o.nombre', 'ASC')
      .skip((base.page - 1) * base.limit)
      .take(base.limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((o) => mapOrganizacionDetalle(o)),
      meta: {
        page: base.page,
        limit: base.limit,
        total,
        totalPages: Math.ceil(total / base.limit) || 0,
      },
    };
  }

  async crear(ctx: OrgContext, body: unknown) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_ORGANIZACIONES_CREAR);

    const input = this.parseCrearOrganizacion(body);

    const porNombre = await this.organizacionRepo.findOne({
      where: { nombre: input.nombre },
    });
    if (porNombre) {
      throw organizacionNombreDuplicado();
    }

    if (input.identificacionFiscal) {
      const porIdFiscal = await this.organizacionRepo.findOne({
        where: { identificacionFiscal: input.identificacionFiscal },
      });
      if (porIdFiscal) {
        throw organizacionIdentificacionDuplicada();
      }
    }

    const vertical = await this.verticalRepo.findOne({
      where: { id: input.verticalId },
    });
    if (!vertical) {
      throw new NotFoundError();
    }
    if (vertical.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw verticalInactivo();
    }
    if (!(vertical.codigo in packsPorCodigo)) {
      throw organizacionPackNoDisponible();
    }
    const pack = getPack(vertical.codigo as CodigoVertical);

    const monedaBase = await this.monedaRepo.findOne({
      where: { id: input.monedaBaseId },
    });
    if (!monedaBase) {
      throw new NotFoundError();
    }
    if (monedaBase.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw monedaInactiva();
    }

    let monedaPresentacionId: string | null = null;
    if (input.monedaPresentacionId) {
      if (input.monedaPresentacionId === input.monedaBaseId) {
        throw organizacionMonedaPresentacionIgualABase();
      }
      const monedaPresentacion = await this.monedaRepo.findOne({
        where: { id: input.monedaPresentacionId },
      });
      if (!monedaPresentacion) {
        throw new NotFoundError();
      }
      if (monedaPresentacion.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw monedaInactiva();
      }
      monedaPresentacionId = monedaPresentacion.id;
    }

    try {
      const resultado = await this.dataSource.transaction(async (manager) => {
        const org = await manager.save(
          Organizacion,
          manager.create(Organizacion, {
            nombre: input.nombre,
            razonSocial: input.razonSocial ?? null,
            identificacionFiscal: input.identificacionFiscal ?? null,
            verticalId: vertical.id,
            telefono: input.telefono ?? null,
            email: input.email ?? null,
            direccion: input.direccion ?? null,
            monedaBaseId: monedaBase.id,
            monedaPresentacionId,
            zonaHoraria: input.zonaHoraria,
            locale: input.locale,
            usaIa: input.usaIa,
            umbralAutomatico: input.umbralAutomatico,
            umbralDescarte: input.umbralDescarte,
            notasInternas: input.notasInternas ?? null,
            estadoRegistro: EstadoRegistro.ACTIVO,
            createdById: ctx.usuarioId,
            updatedById: ctx.usuarioId,
          }),
        );

        const provisionamiento = await this.provisionamiento.provisionar(
          manager,
          org,
          pack,
          input.sucursalPrincipal,
          ctx.usuarioId,
        );

        const completa = await manager.findOneOrFail(Organizacion, {
          where: { id: org.id },
          relations: RELACIONES_ORG,
        });

        return {
          organizacion: mapOrganizacionDetalle(completa),
          provisionamiento,
        };
      });

      return resultado;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw organizacionProvisionamientoFallido(
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  async obtener(ctx: OrgContext, id: string) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_ORGANIZACIONES_VER);

    const org = await this.cargarOrganizacion(id);
    const [
      unidadesMedidaCreadas,
      definicionesAtributoCreadas,
      categoriasCreadas,
      lista,
      plantilla,
      sucursal,
    ] = await Promise.all([
      this.unidadRepo.count({ where: { organizacionId: id } }),
      this.definicionRepo.count({ where: { organizacionId: id } }),
      this.categoriaRepo.count({ where: { organizacionId: id } }),
      this.listaPrecioRepo.findOne({
        where: { organizacionId: id, esPredeterminada: true },
      }),
      this.plantillaRepo.findOne({
        where: { organizacionId: id, esPredeterminada: true },
      }),
      this.sucursalRepo.findOne({
        where: { organizacionId: id, esPrincipal: true },
      }),
    ]);

    return {
      organizacion: mapOrganizacionDetalle(org),
      provisionamiento: {
        verticalCodigo: org.vertical.codigo,
        packVersion: PACK_VERSION,
        sucursalPrincipalId: sucursal?.id ?? null,
        listaPrecioPredeterminadaId: lista?.id ?? null,
        plantillaDocumentoId: plantilla?.id ?? null,
        unidadesMedidaCreadas,
        definicionesAtributoCreadas,
        categoriasCreadas,
      },
    };
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_ORGANIZACIONES_EDITAR);

    const input = editarOrganizacionSchema.parse(body);
    const org = await this.cargarOrganizacion(id);

    if (input.verticalId !== undefined && input.verticalId !== org.verticalId) {
      throw organizacionVerticalNoModificable();
    }

    if (input.nombre !== undefined && input.nombre !== org.nombre) {
      const duplicado = await this.organizacionRepo.findOne({
        where: { nombre: input.nombre },
      });
      if (duplicado && duplicado.id !== id) {
        throw organizacionNombreDuplicado();
      }
      org.nombre = input.nombre;
    }

    if (input.identificacionFiscal !== undefined) {
      const nuevo = input.identificacionFiscal;
      if (nuevo !== null && nuevo !== org.identificacionFiscal) {
        const duplicado = await this.organizacionRepo.findOne({
          where: { identificacionFiscal: nuevo },
        });
        if (duplicado && duplicado.id !== id) {
          throw organizacionIdentificacionDuplicada();
        }
      }
      org.identificacionFiscal = nuevo;
    }

    if (input.razonSocial !== undefined) {
      org.razonSocial = input.razonSocial;
    }
    if (input.telefono !== undefined) {
      org.telefono = input.telefono;
    }
    if (input.email !== undefined) {
      org.email = input.email;
    }
    if (input.direccion !== undefined) {
      org.direccion = input.direccion;
    }
    if (input.zonaHoraria !== undefined) {
      org.zonaHoraria = input.zonaHoraria;
    }
    if (input.locale !== undefined) {
      org.locale = input.locale;
    }
    if (input.usaIa !== undefined) {
      org.usaIa = input.usaIa;
    }
    if (input.notasInternas !== undefined) {
      org.notasInternas = input.notasInternas;
    }

    if (input.umbralAutomatico !== undefined || input.umbralDescarte !== undefined) {
      const auto = Number(input.umbralAutomatico ?? org.umbralAutomatico);
      const desc = Number(input.umbralDescarte ?? org.umbralDescarte);
      if (!(desc < auto)) {
        throw organizacionUmbralesIncoherentes();
      }
      if (input.umbralAutomatico !== undefined) {
        org.umbralAutomatico = input.umbralAutomatico;
      }
      if (input.umbralDescarte !== undefined) {
        org.umbralDescarte = input.umbralDescarte;
      }
    }

    const monedaBaseIdResultante = input.monedaBaseId ?? org.monedaBaseId;
    const monedaPresentacionResultante =
      input.monedaPresentacionId !== undefined
        ? input.monedaPresentacionId
        : (org.monedaPresentacionId ?? null);

    if (
      monedaPresentacionResultante &&
      monedaPresentacionResultante === monedaBaseIdResultante
    ) {
      throw organizacionMonedaPresentacionIgualABase();
    }

    if (input.monedaBaseId !== undefined) {
      const moneda = await this.monedaRepo.findOne({
        where: { id: input.monedaBaseId },
      });
      if (!moneda) {
        throw new NotFoundError();
      }
      if (moneda.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw monedaInactiva();
      }
      org.monedaBaseId = moneda.id;
    }

    if (input.monedaPresentacionId !== undefined) {
      if (input.monedaPresentacionId === null) {
        org.monedaPresentacionId = null;
      } else {
        const moneda = await this.monedaRepo.findOne({
          where: { id: input.monedaPresentacionId },
        });
        if (!moneda) {
          throw new NotFoundError();
        }
        if (moneda.estadoRegistro !== EstadoRegistro.ACTIVO) {
          throw monedaInactiva();
        }
        org.monedaPresentacionId = moneda.id;
      }
    }

    const inactivar =
      input.estadoRegistro === EstadoRegistro.INACTIVO &&
      org.estadoRegistro === EstadoRegistro.ACTIVO;

    if (input.estadoRegistro !== undefined) {
      org.estadoRegistro = input.estadoRegistro as EstadoRegistro;
    }

    org.updatedById = ctx.usuarioId;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(org);

      if (inactivar) {
        const usuarios = await manager.find(Usuario, {
          where: { organizacionId: id },
          select: { id: true },
        });
        const usuarioIds = usuarios.map((u) => u.id);
        if (usuarioIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(Sesion)
            .set({ revocadaAt: new Date() })
            .where('usuarioId IN (:...usuarioIds)', { usuarioIds })
            .andWhere('revocadaAt IS NULL')
            .execute();
        }
      }
    });

    const actualizada = await this.cargarOrganizacion(id);
    return mapOrganizacionDetalle(actualizada);
  }

  async crearUsuarioInicial(ctx: OrgContext, organizacionId: string, body: unknown) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_USUARIOS_ADMINISTRAR);

    const input = crearUsuarioInicialSchema.parse(body);
    const org = await this.cargarOrganizacion(organizacionId);

    if (org.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw organizacionInactiva();
    }

    const perfilAdmin = await this.perfilRepo.findOne({
      where: { codigo: CODIGO_ADMIN_ORG },
    });
    if (!perfilAdmin) {
      throw new NotFoundError(
        'RECURSO_NO_ENCONTRADO',
        'No se encontró el perfil Administrador Organización.',
      );
    }

    const adminsExistentes = await this.usuarioRepo
      .createQueryBuilder('u')
      .innerJoin(UsuarioPerfil, 'up', 'up.usuarioId = u.id')
      .where('u.organizacionId = :organizacionId', { organizacionId })
      .andWhere('u.estadoRegistro = :activo', { activo: EstadoRegistro.ACTIVO })
      .andWhere('up.perfilId = :perfilId', { perfilId: perfilAdmin.id })
      .getCount();

    if (adminsExistentes > 0) {
      throw organizacionYaTieneAdministrador();
    }

    const emailExistente = await this.usuarioRepo.findOne({
      where: { email: input.email },
    });
    if (emailExistente) {
      throw usuarioEmailDuplicado();
    }

    const sucursalPrincipal = await this.sucursalRepo.findOne({
      where: { organizacionId, esPrincipal: true },
    });
    if (!sucursalPrincipal) {
      throw new NotFoundError(
        'ORGANIZACION_SUCURSAL_NO_ENCONTRADA',
        'No se encontró la sucursal principal de la organización.',
      );
    }

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
      const usuario = await manager.save(
        Usuario,
        manager.create(Usuario, {
          organizacionId,
          nombreCompleto: input.nombreCompleto,
          email: input.email,
          telefono: input.telefono ?? null,
          passwordHash,
          debeCambiarPassword: true,
          estadoRegistro: EstadoRegistro.ACTIVO,
          createdById: ctx.usuarioId,
          updatedById: ctx.usuarioId,
        }),
      );

      await manager.save(
        UsuarioPerfil,
        manager.create(UsuarioPerfil, {
          usuarioId: usuario.id,
          perfilId: perfilAdmin.id,
        }),
      );

      await manager.save(
        UsuarioSucursal,
        manager.create(UsuarioSucursal, {
          usuarioId: usuario.id,
          sucursalId: sucursalPrincipal.id,
        }),
      );

      return usuario.id;
    });

    return {
      usuarioId,
      email: input.email,
      passwordTemporal,
      debeCambiarPassword: true as const,
      perfiles: [perfilAdmin.nombre],
      sucursalIds: [sucursalPrincipal.id],
    };
  }

  async metricas(ctx: OrgContext, query: unknown) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_METRICAS_VER);

    const { desde, hasta } = metricasQuerySchema.parse(query);
    const hastaFecha = hasta ?? new Date();
    const desdeFecha =
      desde ??
      new Date(hastaFecha.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Periodo validado para uso futuro cuando existan cotizaciones.
    void desdeFecha;
    void hastaFecha;

    const orgs = await this.organizacionRepo.find({
      relations: { vertical: true },
      order: { nombre: 'ASC' },
    });

    const resultado = await Promise.all(
      orgs.map(async (org) => {
        const usuariosActivos = await this.usuarioRepo.count({
          where: {
            organizacionId: org.id,
            estadoRegistro: EstadoRegistro.ACTIVO,
          },
        });

        const row = await this.usuarioRepo
          .createQueryBuilder('u')
          .select('MAX(u.ultimoAccesoAt)', 'ultimo')
          .where('u.organizacionId = :organizacionId', {
            organizacionId: org.id,
          })
          .getRawOne<{ ultimo: Date | string | null }>();

        const ultimoAccesoAt = row?.ultimo
          ? new Date(row.ultimo).toISOString()
          : null;

        return {
          organizacionId: org.id,
          nombre: org.nombre,
          vertical: org.vertical.codigo,
          estadoRegistro: org.estadoRegistro,
          usuariosActivos,
          itemsActivos: 0,
          cotizacionesTotales: 0,
          cotizacionesPeriodo: 0,
          ultimaCotizacionAt: null as string | null,
          ultimoAccesoAt,
        };
      }),
    );

    return resultado;
  }

  private parseCrearOrganizacion(body: unknown) {
    const parsed = crearOrganizacionSchema.safeParse(body);
    if (!parsed.success) {
      this.mapearErroresCreacion(parsed.error);
      throw parsed.error;
    }
    return parsed.data;
  }

  private mapearErroresCreacion(error: ZodError): void {
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (
        path === 'monedaPresentacionId' ||
        issue.message.toLowerCase().includes('moneda de presentación')
      ) {
        throw organizacionMonedaPresentacionIgualABase();
      }
      if (
        path === 'umbralDescarte' ||
        issue.message.toLowerCase().includes('umbral de descarte')
      ) {
        throw organizacionUmbralesIncoherentes();
      }
    }
  }

  private async cargarOrganizacion(id: string): Promise<Organizacion> {
    const org = await this.organizacionRepo.findOne({
      where: { id },
      relations: RELACIONES_ORG,
    });
    if (!org) {
      throw organizacionNoEncontrada();
    }
    return org;
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
}

export type { OrganizacionDetalle };
