import { Controller, Get } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { UsuariosService } from './usuarios.service';

@Controller('perfiles')
export class PerfilesController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async listar(@OrgCtx() ctx: OrgContext) {
    const data = await this.usuariosService.listarPerfiles(ctx);
    return { data };
  }
}
