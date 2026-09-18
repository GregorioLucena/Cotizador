import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.usuariosService.listar(ctx, query);
    return { data };
  }

  @Post()
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.usuariosService.crear(ctx, body);
    return { data };
  }

  @Get(':id')
  async obtener(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.usuariosService.obtener(ctx, id);
    return { data };
  }

  @Patch(':id')
  async editar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.usuariosService.editar(ctx, id, body);
    return { data };
  }

  @Post(':id/restablecer-password')
  async restablecerPassword(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.usuariosService.restablecerPassword(ctx, id, body);
    return { data };
  }
}
