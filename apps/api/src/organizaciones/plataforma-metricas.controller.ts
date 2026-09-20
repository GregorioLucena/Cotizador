import { Controller, Get, Query } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { ReportesService } from '../reportes/reportes.service';

@Controller('plataforma/metricas')
export class PlataformaMetricasController {
  constructor(private readonly reportes: ReportesService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.reportes.metricasPlataforma(ctx, query);
    return { data };
  }
}
