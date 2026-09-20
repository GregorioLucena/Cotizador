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
import {
  type OrgContext,
  PERMISOS,
  politicaExtraccionSchema,
  requirePermission,
  requirePlataformaContext,
} from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { PromptVersionesService } from './prompt-versiones.service';

@Controller('plataforma/ia')
export class PlataformaIaController {
  constructor(private readonly prompts: PromptVersionesService) {}

  @Get('config')
  async config(@OrgCtx() ctx: OrgContext) {
    const data = await this.prompts.config(ctx);
    return { data };
  }

  @Get('prompts')
  async listar(
    @OrgCtx() ctx: OrgContext,
    @Query('verticalCodigo') verticalCodigo?: string,
  ) {
    const data = await this.prompts.listar(ctx, verticalCodigo);
    return { data };
  }

  @Post('prompts')
  async crear(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.prompts.crear(ctx, body);
    return { data };
  }

  /** Ruta estática antes de :id */
  @Post('prompts/preview')
  async preview(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    requirePlataformaContext(ctx);
    requirePermission(ctx, PERMISOS.PLATAFORMA_IA_VER);
    const raw = body as {
      politica?: unknown;
      codigo?: string;
      verticalCodigo?: string;
    };
    const politica = politicaExtraccionSchema.parse(raw?.politica ?? {});
    const codigo =
      typeof raw?.codigo === 'string' && raw.codigo.trim()
        ? raw.codigo.trim()
        : 'preview';
    const data = this.prompts.previewCompuesto(
      politica,
      codigo,
      raw?.verticalCodigo,
    );
    return { data };
  }

  @Patch('prompts/:id')
  async editar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.prompts.editar(ctx, id, body);
    return { data };
  }

  @Post('prompts/:id/publicar')
  async publicar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.prompts.publicar(ctx, id);
    return { data };
  }

  @Post('prompts/:id/activar')
  async activar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.prompts.activar(ctx, id);
    return { data };
  }

  @Post('prompts/:id/evaluar')
  async evaluar(
    @OrgCtx() ctx: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.prompts.evaluar(ctx, id, body);
    return { data };
  }
}
