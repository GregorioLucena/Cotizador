import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { AliasService } from './alias.service';
import { AplicacionesService } from './aplicaciones.service';
import { BusquedaService } from './busqueda.service';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly busqueda: BusquedaService,
    private readonly alias: AliasService,
    private readonly aplicaciones: AplicacionesService,
  ) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.items.listar(ctx, query);
    return { data };
  }

  @Get('buscar')
  async buscar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.busqueda.buscar(ctx, query);
    return { data };
  }

  @Post('reindexar-busqueda')
  @HttpCode(HttpStatus.OK)
  async reindexar(@OrgCtx() ctx: OrgContext) {
    const data = await this.items.reindexar(ctx);
    return { data };
  }

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.items.obtener(ctx, id);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.items.crear(ctx, body);
    return { data };
  }

  @Patch(':id')
  async editar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.items.editar(ctx, id, body);
    return { data };
  }

  @Get(':id/alias')
  async listarAlias(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.alias.listar(ctx, id);
    return { data };
  }

  @Post(':id/alias')
  @HttpCode(HttpStatus.CREATED)
  async crearAlias(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.alias.crear(ctx, id, body);
    return { data };
  }

  @Delete(':id/alias/:aliasId')
  async depurarAlias(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aliasId', ParseUUIDPipe) aliasId: string,
  ) {
    const data = await this.alias.depurar(ctx, id, aliasId);
    return { data };
  }

  @Get(':id/aplicaciones')
  async listarAplicaciones(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.aplicaciones.listar(ctx, id);
    return { data };
  }

  @Post(':id/aplicaciones')
  @HttpCode(HttpStatus.CREATED)
  async crearAplicacion(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.aplicaciones.crear(ctx, id, body);
    return { data };
  }

  @Patch(':id/aplicaciones/:aplicacionId')
  async editarAplicacion(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aplicacionId', ParseUUIDPipe) aplicacionId: string,
    @Body() body: unknown,
  ) {
    const data = await this.aplicaciones.editar(ctx, id, aplicacionId, body);
    return { data };
  }

  @Delete(':id/aplicaciones/:aplicacionId')
  async eliminarAplicacion(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('aplicacionId', ParseUUIDPipe) aplicacionId: string,
  ) {
    const data = await this.aplicaciones.eliminar(ctx, id, aplicacionId);
    return { data };
  }
}
