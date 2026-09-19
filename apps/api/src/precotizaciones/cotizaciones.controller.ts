import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { PrecotizacionesService } from './precotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly service: PrecotizacionesService) {}

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.service.obtenerCotizacion(ctx, id);
    return { data };
  }
}
