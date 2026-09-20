import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { PlantillasDocumentoService } from './plantillas-documento.service';

@Controller('plantillas-documento')
export class PlantillasDocumentoController {
  constructor(private readonly service: PlantillasDocumentoService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext) {
    const data = await this.service.listar(ctx);
    return { data };
  }

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.service.obtener(ctx, id);
    return { data };
  }

  @Patch(':id')
  async actualizar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.service.actualizar(ctx, id, body);
    return { data };
  }

  @Post(':id/previsualizar')
  async previsualizar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.service.previsualizar(ctx, id, body);
    return { data };
  }
}
