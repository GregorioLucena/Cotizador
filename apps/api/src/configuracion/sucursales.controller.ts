import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { SucursalesService } from './sucursales.service';

@Controller('sucursales')
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext, @Query() query: unknown) {
    const data = await this.sucursalesService.listar(ctx, query);
    return { data };
  }

  @Post()
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.sucursalesService.crear(ctx, body);
    return { data };
  }

  @Get(':id')
  async obtener(@OrgCtx() ctx: OrgContext, @Param('id') id: string) {
    const data = await this.sucursalesService.obtener(ctx, id);
    return { data };
  }

  @Patch(':id')
  async editar(
    @OrgCtx() ctx: OrgContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = await this.sucursalesService.editar(ctx, id, body);
    return { data };
  }
}
