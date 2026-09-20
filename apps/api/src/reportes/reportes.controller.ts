import { Controller, Get, Query } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('cotizaciones-resumen')
  async cotizacionesResumen(
    @OrgCtx() ctx: OrgContext,
    @Query() query: unknown,
  ) {
    const data = await this.reportes.cotizacionesResumen(ctx, query);
    return { data };
  }

  @Get('desempeno-reconocimiento')
  async desempenoReconocimiento(
    @OrgCtx() ctx: OrgContext,
    @Query() query: unknown,
  ) {
    const data = await this.reportes.desempenoReconocimiento(ctx, query);
    return { data };
  }

  @Get('terminos-fallidos')
  async terminosFallidos(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.reportes.terminosFallidos(ctx, query);
    return { data };
  }
}
