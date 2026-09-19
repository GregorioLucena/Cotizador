import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Cliente,
  EstadoRegistro,
  ListaPrecio,
} from '@cotizador/database';
import {
  CLIENTE_REUTILIZADO_POR_WHATSAPP,
  type OrgContext,
  PERMISOS,
  clienteListaInactiva,
  clienteNoEncontrado,
  clienteWhatsappDuplicado,
  clienteYaInactivo,
  clientesListQuerySchema,
  crearClienteSchema,
  editarClienteSchema,
  hasPermission,
  intentarNormalizarTelefonoWhatsapp,
  listaNoEncontrada,
  normalizarTelefonoWhatsapp,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { DataSource, Repository } from 'typeorm';
import {
  type CotizacionResumenDto,
  mapCliente,
} from './clientes.mapper';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(ListaPrecio)
    private readonly listaRepo: Repository<ListaPrecio>,
    private readonly dataSource: DataSource,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CLIENTES_VER);

    const { page, limit, search, estadoRegistro, orden } =
      clientesListQuerySchema.parse(query);

    const qb = this.clienteRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.listaPrecio', 'lista')
      .where('c.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (estadoRegistro !== 'TODOS') {
      qb.andWhere('c.estadoRegistro = :estado', { estado: estadoRegistro });
    }

    if (search) {
      const term = `%${search}%`;
      const whatsappNorm = intentarNormalizarTelefonoWhatsapp(search);
      const digitsOnly = search.replace(/\D/g, '');
      qb.andWhere(
        `(c.nombre ILIKE :term
          OR c.identificacionFiscal ILIKE :term
          OR c.telefonoWhatsapp ILIKE :term
          OR (:whatsappNorm IS NOT NULL AND c.telefonoWhatsapp = :whatsappNorm)
          OR (:digits <> '' AND c.telefonoWhatsapp ILIKE :digitsLike))`,
        {
          term,
          whatsappNorm: whatsappNorm ?? null,
          digits: digitsOnly,
          digitsLike: digitsOnly ? `%${digitsOnly}%` : '',
        },
      );
    }

    if (orden === 'nombre') {
      qb.orderBy('c.nombre', 'ASC');
    } else {
      qb.orderBy('c.updatedAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((c) => mapCliente(c)),
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
    requirePermission(ctx, PERMISOS.CLIENTES_VER);

    const cliente = await this.buscarCliente(ctx.organizacionId!, id);
    const incluirCotizaciones = hasPermission(
      ctx,
      PERMISOS.COTIZACIONES_VER,
    );
    const cotizacionesRecientes = incluirCotizaciones
      ? await this.cargarCotizacionesRecientes(ctx.organizacionId!, id)
      : undefined;

    return mapCliente(cliente, {
      incluirCotizaciones,
      cotizacionesRecientes,
    });
  }

  /**
   * Crea un cliente. Si `ocasional` o `reutilizar` y el WhatsApp ya existe,
   * devuelve el existente con advertencia (sin duplicar).
   */
  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CLIENTES_CREAR);

    const input = crearClienteSchema.parse(body);
    const telefono = normalizarTelefonoWhatsapp(input.telefonoWhatsapp);
    const reutilizar =
      input.ocasional === true || input.reutilizar === true;

    if (telefono && reutilizar) {
      const existente = await this.clienteRepo.findOne({
        where: {
          organizacionId: ctx.organizacionId!,
          telefonoWhatsapp: telefono,
        },
        relations: ['listaPrecio'],
      });
      if (existente) {
        return {
          reutilizado: true as const,
          data: mapCliente(existente, {
            advertencias: [CLIENTE_REUTILIZADO_POR_WHATSAPP],
          }),
        };
      }
    }

    if (telefono) {
      await this.asegurarWhatsappUnico(ctx.organizacionId!, telefono);
    }

    const listaPrecioId = await this.validarLista(
      ctx.organizacionId!,
      input.listaPrecioId,
    );

    const cliente = this.clienteRepo.create({
      organizacionId: ctx.organizacionId!,
      nombre: input.nombre,
      telefonoWhatsapp: telefono,
      email: input.email ?? null,
      identificacionFiscal: input.identificacionFiscal ?? null,
      listaPrecioId: listaPrecioId ?? null,
      direccion: input.direccion ?? null,
      notas: input.notas ?? null,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });
    await this.clienteRepo.save(cliente);

    const completo = await this.buscarCliente(ctx.organizacionId!, cliente.id);
    return {
      reutilizado: false as const,
      data: mapCliente(completo),
    };
  }

  async editar(ctx: OrgContext, id: string, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CLIENTES_EDITAR);

    const input = editarClienteSchema.parse(body);
    const cliente = await this.buscarCliente(ctx.organizacionId!, id);

    if (input.nombre !== undefined) cliente.nombre = input.nombre;

    if (input.telefonoWhatsapp !== undefined) {
      const telefono = normalizarTelefonoWhatsapp(input.telefonoWhatsapp);
      if (telefono) {
        await this.asegurarWhatsappUnico(
          ctx.organizacionId!,
          telefono,
          id,
        );
      }
      cliente.telefonoWhatsapp = telefono;
    }

    if (input.email !== undefined) cliente.email = input.email;
    if (input.identificacionFiscal !== undefined) {
      cliente.identificacionFiscal = input.identificacionFiscal;
    }
    if (input.direccion !== undefined) cliente.direccion = input.direccion;
    if (input.notas !== undefined) cliente.notas = input.notas;

    if (input.listaPrecioId !== undefined) {
      cliente.listaPrecioId = await this.validarLista(
        ctx.organizacionId!,
        input.listaPrecioId,
      );
    }

    if (input.estadoRegistro === 'INACTIVO') {
      if (cliente.estadoRegistro === EstadoRegistro.INACTIVO) {
        throw clienteYaInactivo();
      }
      cliente.estadoRegistro = EstadoRegistro.INACTIVO;
    } else if (input.estadoRegistro === 'ACTIVO') {
      if (cliente.telefonoWhatsapp) {
        await this.asegurarWhatsappUnico(
          ctx.organizacionId!,
          cliente.telefonoWhatsapp,
          id,
        );
      }
      cliente.estadoRegistro = EstadoRegistro.ACTIVO;
    }

    cliente.updatedById = ctx.usuarioId;
    await this.clienteRepo.save(cliente);

    const completo = await this.buscarCliente(ctx.organizacionId!, id);
    return mapCliente(completo);
  }

  private async buscarCliente(
    organizacionId: string,
    id: string,
  ): Promise<Cliente> {
    const cliente = await this.clienteRepo.findOne({
      where: { id, organizacionId },
      relations: ['listaPrecio'],
    });
    if (!cliente) throw clienteNoEncontrado();
    return cliente;
  }

  private async asegurarWhatsappUnico(
    organizacionId: string,
    telefono: string,
    excludeId?: string,
  ) {
    const existente = await this.clienteRepo.findOne({
      where: { organizacionId, telefonoWhatsapp: telefono },
    });
    if (existente && existente.id !== excludeId) {
      throw clienteWhatsappDuplicado();
    }
  }

  /**
   * Valida lista activa de la organización. `undefined` = no tocar;
   * `null` = quitar asignación. Ajena → 404. Inactiva → CLIENTE_LISTA_INACTIVA.
   */
  private async validarLista(
    organizacionId: string,
    listaPrecioId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (listaPrecioId === undefined) return undefined;
    if (listaPrecioId === null) return null;

    const lista = await this.listaRepo.findOne({
      where: { id: listaPrecioId, organizacionId },
    });
    if (!lista) throw listaNoEncontrada();
    if (lista.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw clienteListaInactiva();
    }
    return lista.id;
  }

  /**
   * Últimas 10 cotizaciones del cliente. Si la tabla aún no existe (spec 008/009),
   * devuelve [] sin fallar.
   */
  private async cargarCotizacionesRecientes(
    organizacionId: string,
    clienteId: string,
  ): Promise<CotizacionResumenDto[]> {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'cotizaciones'
        ) AS "existe"
        `,
      );
      if (!rows?.[0]?.existe) return [];

      const cotizaciones = await this.dataSource.query(
        `
        SELECT "id", "folio", "estado", "total"::text AS "total", "createdAt"
        FROM "cotizaciones"
        WHERE "organizacionId" = $1 AND "clienteId" = $2
        ORDER BY "createdAt" DESC
        LIMIT 10
        `,
        [organizacionId, clienteId],
      );

      return (cotizaciones as Array<{
        id: string;
        folio: string;
        estado: string;
        total: string;
        createdAt: Date | string;
      }>).map((c) => ({
        id: c.id,
        folio: c.folio,
        estado: c.estado,
        total: c.total,
        createdAt:
          c.createdAt instanceof Date
            ? c.createdAt.toISOString()
            : String(c.createdAt),
      }));
    } catch {
      return [];
    }
  }
}
