import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { TasasCambioService } from './tasas-cambio.service';

@Controller('tasas-cambio')
export class TasasCambioController {
  constructor(private readonly service: TasasCambioService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.service.listar(ctx, query);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.service.crear(ctx, body);
    return { data };
  }
}
