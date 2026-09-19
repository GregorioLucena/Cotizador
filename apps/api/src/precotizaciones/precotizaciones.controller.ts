import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { PrecotizacionesService } from './precotizaciones.service';

@Controller('precotizaciones')
export class PrecotizacionesController {
  constructor(private readonly service: PrecotizacionesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.service.crear(ctx, body);
    return { data };
  }

  @Post(':solicitudId/reprocesar')
  @HttpCode(HttpStatus.CREATED)
  async reprocesar(
    @OrgCtx() ctx: OrgContext,
    @Param('solicitudId', ParseUUIDPipe) solicitudId: string,
    @Body() body: unknown,
  ) {
    const data = await this.service.reprocesar(ctx, solicitudId, body);
    return { data };
  }
}
