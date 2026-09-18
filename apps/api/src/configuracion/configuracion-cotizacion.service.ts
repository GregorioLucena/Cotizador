import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConfiguracionCotizacion,
  EstadoRegistro,
  ListaPrecio,
  ModoRedondeo,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  NotFoundError,
  editarConfiguracionCotizacionSchema,
  impuestoPorcentajeRequerido,
  listaPrecioInactiva,
  organizacionConfiguracionAusente,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { mapConfiguracionCotizacion } from './configuracion.mapper';

@Injectable()
export class ConfiguracionCotizacionService {
  constructor(
    @InjectRepository(ConfiguracionCotizacion)
    private readonly configRepo: Repository<ConfiguracionCotizacion>,
    @InjectRepository(ListaPrecio)
    private readonly listaRepo: Repository<ListaPrecio>,
  ) {}

  async obtener(ctx: OrgContext) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_VER);
    const cfg = await this.cargar(ctx.organizacionId);
    return mapConfiguracionCotizacion(cfg);
  }

  async editar(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR);

    const input = editarConfiguracionCotizacionSchema.parse(body);
    const cfg = await this.cargar(ctx.organizacionId);

    if (input.vigenciaHorasPredeterminada !== undefined) {
      cfg.vigenciaHorasPredeterminada = input.vigenciaHorasPredeterminada;
    }
    if (input.aplicaImpuesto !== undefined) {
      cfg.aplicaImpuesto = input.aplicaImpuesto;
    }
    if (input.porcentajeImpuesto !== undefined) {
      cfg.porcentajeImpuesto = input.porcentajeImpuesto;
    }
    if (input.preciosIncluyenImpuesto !== undefined) {
      cfg.preciosIncluyenImpuesto = input.preciosIncluyenImpuesto;
    }
    if (input.decimalesRedondeo !== undefined) {
      cfg.decimalesRedondeo = input.decimalesRedondeo;
    }
    if (input.modoRedondeo !== undefined) {
      cfg.modoRedondeo = input.modoRedondeo as ModoRedondeo;
    }
    if (input.mostrarDescuentoDetallado !== undefined) {
      cfg.mostrarDescuentoDetallado = input.mostrarDescuentoDetallado;
    }
    if (input.permiteSobrescribirPrecio !== undefined) {
      cfg.permiteSobrescribirPrecio = input.permiteSobrescribirPrecio;
    }

    const aplica = cfg.aplicaImpuesto;
    if (aplica) {
      const pct = Number(cfg.porcentajeImpuesto);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        throw impuestoPorcentajeRequerido();
      }
    }

    if (input.listaPrecioPredeterminadaId !== undefined) {
      const lista = await this.listaRepo.findOne({
        where: {
          id: input.listaPrecioPredeterminadaId,
          organizacionId: ctx.organizacionId,
        },
      });
      if (!lista) {
        throw new NotFoundError();
      }
      if (lista.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw listaPrecioInactiva();
      }
      cfg.listaPrecioPredeterminadaId = lista.id;
    }

    cfg.updatedById = ctx.usuarioId;
    await this.configRepo.save(cfg);
    const actualizada = await this.cargar(ctx.organizacionId);
    return mapConfiguracionCotizacion(actualizada);
  }

  private async cargar(organizacionId: string): Promise<ConfiguracionCotizacion> {
    const cfg = await this.configRepo.findOne({
      where: { organizacionId },
      relations: { listaPrecioPredeterminada: true },
    });
    if (!cfg) throw organizacionConfiguracionAusente();
    return cfg;
  }
}
