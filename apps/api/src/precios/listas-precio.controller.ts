import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { ListasPrecioService } from './listas-precio.service';

@Controller('listas-precio')
export class ListasPrecioController {
  constructor(private readonly service: ListasPrecioService) {}

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
  @HttpCode(HttpStatus.CREATED)
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.service.crear(ctx, body);
    return { data };
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

  @Get(':id/precios')
  async listarPrecios(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: unknown,
  ) {
    const data = await this.service.listarPrecios(ctx, id, query);
    return { data };
  }

  @Put(':id/precios')
  async upsertPrecio(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.service.upsertPrecio(ctx, id, body);
    return { data };
  }
}
