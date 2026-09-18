import { Controller, Get, Query } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { OrganizacionesService } from './organizaciones.service';

@Controller('plataforma/metricas')
export class PlataformaMetricasController {
  constructor(private readonly organizacionesService: OrganizacionesService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.organizacionesService.metricas(ctx, query);
    return { data };
  }
}
