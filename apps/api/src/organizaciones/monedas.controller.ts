import { Controller, Get } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { OrganizacionesService } from './organizaciones.service';

@Controller('monedas')
export class MonedasController {
  constructor(private readonly organizacionesService: OrganizacionesService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext) {
    const data = await this.organizacionesService.listarMonedas(ctx);
    return { data };
  }
}
