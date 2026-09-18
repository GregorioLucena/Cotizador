import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { ConfiguracionCotizacionService } from './configuracion-cotizacion.service';

@Controller('configuracion-cotizacion')
export class ConfiguracionCotizacionController {
  constructor(private readonly service: ConfiguracionCotizacionService) {}

  @Get()
  async obtener(@OrgCtx() ctx: OrgContext) {
    const data = await this.service.obtener(ctx);
    return { data };
  }

  @Patch()
  async editar(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.service.editar(ctx, body);
    return { data };
  }
}
