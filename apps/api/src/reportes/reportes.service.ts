import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  EstadoCotizacion,
  EstadoResolucionLinea,
  Organizacion,
  TerminoNoResuelto,
  TipoEventoCotizacion,
} from '@cotizador/database';
import {
  type CotizacionesResumen,
  type DesempenoReconocimiento,
  type MetricasPlataforma,
  type OrgContext,
  type TerminoFallido,
  PERMISOS,
  cantidadPorEstadoVacia,
  formatImporte,
  medianaMs,
  normalizarTexto,
  periodoInvalido,
  periodoReporteQuerySchema,
  requireOrganizacionContext,
  requirePermission,
  requirePlataformaContext,
  tasaComoCadena,
} from '@cotizador/shared';
import { Repository } from 'typeorm';

const ESTADOS_MONTO_APROBADO: EstadoCotizacion[] = [
  EstadoCotizacion.APROBADA,
  EstadoCotizacion.ENVIADA,
  EstadoCotizacion.GANADA,
  EstadoCotizacion.PERDIDA,
  EstadoCotizacion.VENCIDA,
];

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Cotizacion)
    private readonly cotizacionRepo: Repository<Cotizacion>,
    @InjectRepository(CotizacionLinea)
    private readonly lineaRepo: Repository<CotizacionLinea>,
    @InjectRepository(CotizacionEvento)
    private readonly eventoRepo: Repository<CotizacionEvento>,
    @InjectRepository(TerminoNoResuelto)
    private readonly terminoRepo: Repository<TerminoNoResuelto>,
    @InjectRepository(Organizacion)
    private readonly orgRepo: Repository<Organizacion>,
  ) {}

  async cotizacionesResumen(
    ctx: OrgContext,
    query: unknown,
  ): Promise<CotizacionesResumen> {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.REPORTES_VER);
    const orgId = ctx.organizacionId!;
    const { desde, hasta } = await this.resolverPeriodo(orgId, query);

    const cotizaciones = await this.cotizacionRepo
      .createQueryBuilder('c')
      .where('c.organizacionId = :orgId', { orgId })
      .andWhere('c.createdAt >= :desde', { desde })
      .andWhere('c.createdAt <= :hasta', { hasta })
      .getMany();

    const cantidadPorEstado = cantidadPorEstadoVacia();
    for (const c of cotizaciones) {
      if (c.anulado || c.estado === EstadoCotizacion.ANULADA) {
        cantidadPorEstado.ANULADA += 1;
        continue;
      }
      const key = c.estado as keyof typeof cantidadPorEstado;
      if (key in cantidadPorEstado) {
        cantidadPorEstado[key] += 1;
      }
    }

    const tiempoMedianoCapturaAprobacionMs =
      await this.medianaCapturaAprobacion(orgId, desde, hasta);

    let montoTotalAprobado = 0;
    let montoGanado = 0;
    let montoPerdido = 0;
    let ganadas = 0;
    let perdidas = 0;

    for (const c of cotizaciones) {
      if (c.anulado) continue;
      const total = Number(c.total);
      if (
        ESTADOS_MONTO_APROBADO.includes(c.estado) &&
        c.estado !== EstadoCotizacion.ANULADA
      ) {
        montoTotalAprobado += total;
      }
      if (c.estado === EstadoCotizacion.GANADA) {
        montoGanado += total;
        ganadas += 1;
      }
      if (c.estado === EstadoCotizacion.PERDIDA) {
        montoPerdido += total;
        perdidas += 1;
      }
    }

    const vencidasPendientesDeMarca = await this.cotizacionRepo
      .createQueryBuilder('c')
      .where('c.organizacionId = :orgId', { orgId })
      .andWhere('c.estado = :estado', { estado: EstadoCotizacion.ENVIADA })
      .andWhere('c.vigenciaHasta IS NOT NULL')
      .andWhere('c.vigenciaHasta < :now', { now: new Date() })
      .andWhere('c.anulado = false')
      .getCount();

    return {
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      cantidadPorEstado,
      tiempoMedianoCapturaAprobacionMs,
      montoTotalAprobado: formatImporte(montoTotalAprobado),
      montoGanado: formatImporte(montoGanado),
      montoPerdido: formatImporte(montoPerdido),
      conversion: tasaComoCadena(ganadas, ganadas + perdidas),
      vencidasPendientesDeMarca,
    };
  }

  async desempenoReconocimiento(
    ctx: OrgContext,
    query: unknown,
  ): Promise<DesempenoReconocimiento> {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.REPORTES_VER);
    const orgId = ctx.organizacionId!;
    const { desde, hasta } = await this.resolverPeriodo(orgId, query);

    const lineas = await this.lineaRepo
      .createQueryBuilder('l')
      .innerJoin(Cotizacion, 'c', 'c.id = l.cotizacionId')
      .where('l.organizacionId = :orgId', { orgId })
      .andWhere('c.organizacionId = :orgId', { orgId })
      .andWhere('c.createdAt >= :desde', { desde })
      .andWhere('c.createdAt <= :hasta', { hasta })
      .andWhere('l.activa = true')
      .getMany();

    const lineasTotales = lineas.length;
    const lineasAutomaticas = lineas.filter(
      (l) => l.estadoResolucion === EstadoResolucionLinea.RESUELTA_AUTOMATICA,
    ).length;

    const eventosCorreccion = await this.eventoRepo
      .createQueryBuilder('e')
      .innerJoin(Cotizacion, 'c', 'c.id = e.cotizacionId')
      .where('e.organizacionId = :orgId', { orgId })
      .andWhere('e.tipo = :tipo', {
        tipo: TipoEventoCotizacion.LINEA_CORREGIDA,
      })
      .andWhere('c.createdAt >= :desde', { desde })
      .andWhere('c.createdAt <= :hasta', { hasta })
      .getCount();

    return {
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      lineasTotales,
      lineasAutomaticas,
      eventosCorreccion,
      tasaAutomaticas: tasaComoCadena(lineasAutomaticas, lineasTotales),
      tasaCorreccion: tasaComoCadena(eventosCorreccion, lineasTotales),
    };
  }

  async terminosFallidos(
    ctx: OrgContext,
    query: unknown,
  ): Promise<TerminoFallido[]> {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.REPORTES_VER);
    const orgId = ctx.organizacionId!;
    const input = this.parsePeriodoQuery(query);
    const { desde, hasta } = await this.resolverPeriodo(orgId, query);
    const limit = input.limit ?? 20;

    const primarios = await this.terminoRepo
      .createQueryBuilder('t')
      .where('t.organizacionId = :orgId', { orgId })
      .andWhere('t.ultimaVezAt >= :desde', { desde })
      .andWhere('t.ultimaVezAt <= :hasta', { hasta })
      .orderBy('t.vecesVisto', 'DESC')
      .addOrderBy('t.ultimaVezAt', 'DESC')
      .take(limit)
      .getMany();

    const mapa = new Map<string, TerminoFallido>();
    for (const t of primarios) {
      mapa.set(t.textoNormalizado, {
        textoNormalizado: t.textoNormalizado,
        ejemploOriginal: t.ejemploOriginal,
        vecesVisto: t.vecesVisto,
        resueltoConItemId: t.resueltoConItemId ?? null,
      });
    }

    if (mapa.size < limit) {
      const lineasNoEncontradas = await this.lineaRepo
        .createQueryBuilder('l')
        .innerJoin(Cotizacion, 'c', 'c.id = l.cotizacionId')
        .where('l.organizacionId = :orgId', { orgId })
        .andWhere('c.createdAt >= :desde', { desde })
        .andWhere('c.createdAt <= :hasta', { hasta })
        .andWhere('l.activa = true')
        .andWhere('l.estadoResolucion = :estado', {
          estado: EstadoResolucionLinea.NO_ENCONTRADA,
        })
        .getMany();

      const eventos = await this.eventoRepo
        .createQueryBuilder('e')
        .innerJoin(Cotizacion, 'c', 'c.id = e.cotizacionId')
        .where('e.organizacionId = :orgId', { orgId })
        .andWhere('e.tipo = :tipo', {
          tipo: TipoEventoCotizacion.LINEA_CORREGIDA,
        })
        .andWhere('c.createdAt >= :desde', { desde })
        .andWhere('c.createdAt <= :hasta', { hasta })
        .getMany();

      const agregar = (texto: string, ejemplo: string) => {
        const key = normalizarTexto(texto);
        if (!key || mapa.has(key)) return;
        const existente = [...mapa.values()].find(
          (x) => x.textoNormalizado === key,
        );
        if (existente) {
          existente.vecesVisto += 1;
          return;
        }
        mapa.set(key, {
          textoNormalizado: key,
          ejemploOriginal: ejemplo,
          vecesVisto: 1,
          resueltoConItemId: null,
        });
      };

      for (const l of lineasNoEncontradas) {
        agregar(l.textoSolicitado, l.textoSolicitado);
      }
      for (const e of eventos) {
        const datos = (e.datos ?? {}) as { textoSolicitado?: string };
        if (datos.textoSolicitado) {
          agregar(datos.textoSolicitado, datos.textoSolicitado);
        }
      }
    }

    return [...mapa.values()]
      .sort((a, b) => b.vecesVisto - a.vecesVisto)
      .slice(0, limit);
  }

  async metricasPlataforma(
    ctx: OrgContext,
    query: unknown,
  ): Promise<MetricasPlataforma> {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_METRICAS_VER);

    const input = this.parsePeriodoQuery(query);
    const hasta = input.hasta ?? new Date();
    const desde =
      input.desde ??
      new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);

    const cotizaciones = await this.cotizacionRepo
      .createQueryBuilder('c')
      .where('c.createdAt >= :desde', { desde })
      .andWhere('c.createdAt <= :hasta', { hasta })
      .getMany();

    const cotizacionesTotales = cotizaciones.length;
    const orgIdsActivas = new Set(cotizaciones.map((c) => c.organizacionId));

    const eventosAprobacion = await this.eventoRepo
      .createQueryBuilder('e')
      .where('e.tipo = :tipo', { tipo: TipoEventoCotizacion.APROBADA })
      .andWhere('e.createdAt >= :desde', { desde })
      .andWhere('e.createdAt <= :hasta', { hasta })
      .getMany();

    const aprobadasTotales = new Set(
      eventosAprobacion.map((e) => e.cotizacionId),
    ).size;

    const ganadasTotales = cotizaciones.filter(
      (c) => !c.anulado && c.estado === EstadoCotizacion.GANADA,
    ).length;
    const perdidasTotales = cotizaciones.filter(
      (c) => !c.anulado && c.estado === EstadoCotizacion.PERDIDA,
    ).length;

    const tiempoMedianoGlobalMs = await this.medianaCapturaAprobacion(
      null,
      desde,
      hasta,
    );

    const result: MetricasPlataforma = {
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      organizacionesActivas: orgIdsActivas.size,
      cotizacionesTotales,
      aprobadasTotales,
      tasaAprobacionGlobal: tasaComoCadena(
        aprobadasTotales,
        cotizacionesTotales,
      ),
      tiempoMedianoGlobalMs,
      ganadasTotales,
      perdidasTotales,
    };

    if (input.detalle) {
      const orgs = await this.orgRepo.find({
        order: { nombre: 'ASC' },
      });
      const aprobadasPorOrg = new Map<string, Set<string>>();
      for (const e of eventosAprobacion) {
        const set = aprobadasPorOrg.get(e.organizacionId) ?? new Set();
        set.add(e.cotizacionId);
        aprobadasPorOrg.set(e.organizacionId, set);
      }

      result.porOrganizacion = orgs
        .map((org) => {
          const delOrg = cotizaciones.filter(
            (c) => c.organizacionId === org.id,
          );
          if (delOrg.length === 0) return null;
          return {
            organizacionId: org.id,
            nombre: org.nombre,
            cotizaciones: delOrg.length,
            aprobadas: aprobadasPorOrg.get(org.id)?.size ?? 0,
            ganadas: delOrg.filter(
              (c) => !c.anulado && c.estado === EstadoCotizacion.GANADA,
            ).length,
            perdidas: delOrg.filter(
              (c) => !c.anulado && c.estado === EstadoCotizacion.PERDIDA,
            ).length,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
    }

    return result;
  }

  private parsePeriodoQuery(query: unknown) {
    const parsed = periodoReporteQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw periodoInvalido(parsed.error.flatten());
    }
    return parsed.data;
  }

  private async resolverPeriodo(
    organizacionId: string | null,
    query: unknown,
  ): Promise<{ desde: Date; hasta: Date }> {
    const input = this.parsePeriodoQuery(query);
    if (input.desde && input.hasta) {
      return { desde: input.desde, hasta: input.hasta };
    }

    let zona = 'UTC';
    if (organizacionId) {
      const org = await this.orgRepo.findOne({
        where: { id: organizacionId },
      });
      if (org?.zonaHoraria) zona = org.zonaHoraria;
    }

    const hasta = input.hasta ?? this.ahoraEnZonaComoUtcFin(zona);
    const desde =
      input.desde ?? this.restarDiasCalendario(hasta, 30, zona);
    if (desde.getTime() > hasta.getTime()) {
      throw periodoInvalido({ desde, hasta });
    }
    return { desde, hasta };
  }

  /** Fin del día actual en la zona, expresado como instante UTC. */
  private ahoraEnZonaComoUtcFin(zona: string): Date {
    try {
      const parts = this.partesFechaZona(new Date(), zona);
      return this.instanteDesdePartesZona(
        parts.y,
        parts.m,
        parts.d,
        23,
        59,
        59,
        999,
        zona,
      );
    } catch {
      return new Date();
    }
  }

  private restarDiasCalendario(
    hasta: Date,
    dias: number,
    zona: string,
  ): Date {
    try {
      const parts = this.partesFechaZona(hasta, zona);
      const base = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
      base.setUTCDate(base.getUTCDate() - (dias - 1));
      return this.instanteDesdePartesZona(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        0,
        0,
        0,
        0,
        zona,
      );
    } catch {
      return new Date(hasta.getTime() - dias * 24 * 60 * 60 * 1000);
    }
  }

  private partesFechaZona(
    date: Date,
    zona: string,
  ): { y: number; m: number; d: number } {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const bits = fmt.formatToParts(date);
    const get = (t: string) =>
      Number(bits.find((p) => p.type === t)?.value ?? NaN);
    return { y: get('year'), m: get('month'), d: get('day') };
  }

  private instanteDesdePartesZona(
    y: number,
    m: number,
    d: number,
    hh: number,
    mm: number,
    ss: number,
    ms: number,
    zona: string,
  ): Date {
    const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss, ms);
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    let t = utcGuess;
    for (let i = 0; i < 3; i++) {
      const parts = fmt.formatToParts(new Date(t));
      const g = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value ?? 0);
      const got = Date.UTC(
        g('year'),
        g('month') - 1,
        g('day'),
        g('hour'),
        g('minute'),
        g('second'),
      );
      const want = Date.UTC(y, m - 1, d, hh, mm, ss);
      t += want - got;
    }
    return new Date(t + ms);
  }

  /**
   * Mediana captura→aprobación. Usa tipos cortos del diseño (`CREADA`/`APROBADA`).
   */
  private async medianaCapturaAprobacion(
    organizacionId: string | null,
    desde: Date,
    hasta: Date,
  ): Promise<number | null> {
    const qbAprob = this.eventoRepo
      .createQueryBuilder('ea')
      .where('ea.tipo = :tipoA', { tipoA: TipoEventoCotizacion.APROBADA })
      .andWhere('ea.createdAt >= :desde', { desde })
      .andWhere('ea.createdAt <= :hasta', { hasta });
    if (organizacionId) {
      qbAprob.andWhere('ea.organizacionId = :orgId', {
        orgId: organizacionId,
      });
    }
    const aprobaciones = await qbAprob.getMany();
    if (aprobaciones.length === 0) return null;

    const cotizacionIds = [...new Set(aprobaciones.map((e) => e.cotizacionId))];
    const creaciones = await this.eventoRepo
      .createQueryBuilder('ec')
      .where('ec.tipo = :tipoC', { tipoC: TipoEventoCotizacion.CREADA })
      .andWhere('ec.cotizacionId IN (:...ids)', { ids: cotizacionIds })
      .getMany();

    const primeraCreacion = new Map<string, Date>();
    for (const e of creaciones) {
      const prev = primeraCreacion.get(e.cotizacionId);
      if (!prev || e.createdAt < prev) {
        primeraCreacion.set(e.cotizacionId, e.createdAt);
      }
    }

    const duraciones: number[] = [];
    for (const a of aprobaciones) {
      const creada = primeraCreacion.get(a.cotizacionId);
      if (!creada) continue;
      const ms = a.createdAt.getTime() - creada.getTime();
      if (ms >= 0) duraciones.push(ms);
    }

    return medianaMs(duraciones);
  }
}
