import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import type { Response } from 'express';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.service.listar(ctx, query);
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

  @Post()
  async crear(
    @OrgCtx() ctx: OrgContext,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.crear(ctx, body);
    res.status(result.reutilizado ? HttpStatus.OK : HttpStatus.CREATED);
    return { data: result.data };
  }

  @Patch(':id')
  async editar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.service.editar(ctx, id, body);
    return { data };
  }
}
