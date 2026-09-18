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
  Query,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { OrganizacionesService } from './organizaciones.service';

@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private readonly organizacionesService: OrganizacionesService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.organizacionesService.listar(ctx, query);
    return { data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.organizacionesService.crear(ctx, body);
    return { data };
  }

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.organizacionesService.obtener(ctx, id);
    return { data };
  }

  @Patch(':id')
  async editar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.organizacionesService.editar(ctx, id, body);
    return { data };
  }

  @Post(':id/usuario-inicial')
  @HttpCode(HttpStatus.CREATED)
  async crearUsuarioInicial(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.organizacionesService.crearUsuarioInicial(
      ctx,
      id,
      body,
    );
    return { data };
  }
}
