import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { MultipartArchivoInterceptor } from '../common/interceptors/multipart-archivo.interceptor';
import { ConfiguracionOrganizacionService } from './configuracion-organizacion.service';
import { LogoService } from './logo.service';

@Controller('configuracion-organizacion')
export class ConfiguracionOrganizacionController {
  constructor(
    private readonly configuracionService: ConfiguracionOrganizacionService,
    private readonly logoService: LogoService,
  ) {}

  @Get()
  async obtener(@OrgCtx() ctx: OrgContext) {
    const data = await this.configuracionService.obtener(ctx);
    return { data };
  }

  @Patch()
  async editar(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.configuracionService.editar(ctx, body);
    return { data };
  }

  @Post('logo')
  @UseInterceptors(MultipartArchivoInterceptor('archivo', 2 * 1024 * 1024))
  async subirLogo(
    @OrgCtx() ctx: OrgContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.logoService.subir(ctx, file);
    return { data };
  }

  @Delete('logo')
  async eliminarLogo(@OrgCtx() ctx: OrgContext) {
    const data = await this.logoService.eliminar(ctx);
    return { data };
  }
}
