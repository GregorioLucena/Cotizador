import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EstadoRegistro,
  FuenteTasaCambio,
  Moneda,
  TasaCambio,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  crearTasaCambioSchema,
  formatTasa,
  requireOrganizacionContext,
  requirePermission,
  tasaDuplicada,
  tasaMonedasIguales,
  tasaNoEncontrada,
  tasasListQuerySchema,
} from '@cotizador/shared';
import { Repository } from 'typeorm';
import { mapTasaCambio } from './precios.mapper';

@Injectable()
export class TasasCambioService {
  constructor(
    @InjectRepository(TasaCambio)
    private readonly tasaRepo: Repository<TasaCambio>,
    @InjectRepository(Moneda)
    private readonly monedaRepo: Repository<Moneda>,
  ) {}

  async listar(ctx: OrgContext, query: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_TASAS_ADMINISTRAR);

    const parsed = tasasListQuerySchema.parse(query);

    if (parsed.vigente) {
      return this.obtenerVigente(ctx, parsed);
    }

    const qb = this.tasaRepo
      .createQueryBuilder('t')
      .where('t.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      });

    if (parsed.estadoRegistro !== 'TODOS') {
      qb.andWhere('t.estadoRegistro = :estado', {
        estado: parsed.estadoRegistro,
      });
    }
    if (parsed.monedaOrigenId) {
      qb.andWhere('t.monedaOrigenId = :origen', {
        origen: parsed.monedaOrigenId,
      });
    }
    if (parsed.monedaDestinoId) {
      qb.andWhere('t.monedaDestinoId = :destino', {
        destino: parsed.monedaDestinoId,
      });
    }

    qb.orderBy('t.fechaVigencia', 'DESC')
      .skip((parsed.page - 1) * parsed.limit)
      .take(parsed.limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(mapTasaCambio),
      meta: {
        page: parsed.page,
        limit: parsed.limit,
        total,
        totalPages: Math.ceil(total / parsed.limit) || 0,
      },
    };
  }

  async crear(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.PRECIOS_TASAS_ADMINISTRAR);

    const input = crearTasaCambioSchema.parse(body);
    if (input.monedaOrigenId === input.monedaDestinoId) {
      throw tasaMonedasIguales();
    }

    await this.asegurarMoneda(input.monedaOrigenId);
    await this.asegurarMoneda(input.monedaDestinoId);

    const duplicada = await this.tasaRepo.findOne({
      where: {
        organizacionId: ctx.organizacionId!,
        monedaOrigenId: input.monedaOrigenId,
        monedaDestinoId: input.monedaDestinoId,
        fechaVigencia: input.fechaVigencia,
      },
    });
    if (duplicada) throw tasaDuplicada();

    const tasa = this.tasaRepo.create({
      organizacionId: ctx.organizacionId!,
      monedaOrigenId: input.monedaOrigenId,
      monedaDestinoId: input.monedaDestinoId,
      valor: formatTasa(input.valor),
      fechaVigencia: input.fechaVigencia,
      fuente: FuenteTasaCambio.MANUAL,
      estadoRegistro: EstadoRegistro.ACTIVO,
      createdById: ctx.usuarioId,
      updatedById: ctx.usuarioId,
    });

    await this.tasaRepo.save(tasa);
    return mapTasaCambio(tasa);
  }

  private async obtenerVigente(
    ctx: OrgContext,
    parsed: {
      monedaOrigenId?: string;
      monedaDestinoId?: string;
      fechaReferencia?: string;
      page: number;
      limit: number;
    },
  ) {
    if (!parsed.monedaOrigenId || !parsed.monedaDestinoId) {
      throw tasaNoEncontrada();
    }
    const fecha = parsed.fechaReferencia ?? '9999-12-31';

    const tasa = await this.tasaRepo
      .createQueryBuilder('t')
      .where('t.organizacionId = :organizacionId', {
        organizacionId: ctx.organizacionId,
      })
      .andWhere('t.monedaOrigenId = :origen', { origen: parsed.monedaOrigenId })
      .andWhere('t.monedaDestinoId = :destino', {
        destino: parsed.monedaDestinoId,
      })
      .andWhere('t.estadoRegistro = :estado', { estado: EstadoRegistro.ACTIVO })
      .andWhere('t.fechaVigencia <= :fecha', { fecha })
      .orderBy('t.fechaVigencia', 'DESC')
      .getOne();

    if (!tasa) throw tasaNoEncontrada();

    return {
      items: [mapTasaCambio(tasa)],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
      vigente: mapTasaCambio(tasa),
    };
  }

  private async asegurarMoneda(id: string) {
    const moneda = await this.monedaRepo.findOne({ where: { id } });
    if (!moneda || moneda.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw tasaNoEncontrada();
    }
  }
}
