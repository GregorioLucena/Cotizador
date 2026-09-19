import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { TerminosNoResueltosService } from './terminos-no-resueltos.service';

@Controller('terminos-no-resueltos')
export class TerminosNoResueltosController {
  constructor(private readonly service: TerminosNoResueltosService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.service.listar(ctx, query);
    return { data };
  }

  @Patch(':id')
  async cerrar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.service.cerrar(ctx, id, body);
    return { data };
  }
}
