import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { OrgContext } from '@cotizador/shared';
import { OrgCtx } from '../common/decorators/org-ctx.decorator';
import { Publico } from '../common/decorators/publico.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Publico()
  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { resultado, refreshToken } = await this.authService.login(body, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie('refreshToken', refreshToken, this.authService.cookieOptions());
    return { data: resultado };
  }

  @Publico()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken =
      typeof req.cookies?.refreshToken === 'string'
        ? req.cookies.refreshToken
        : undefined;
    const { resultado, refreshToken } = await this.authService.refresh(cookieToken);
    res.cookie('refreshToken', refreshToken, this.authService.cookieOptions());
    return { data: resultado };
  }

  @Post('logout')
  async logout(
    @OrgCtx() ctx: OrgContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.logout(ctx);
    res.clearCookie('refreshToken', this.authService.cookieOptions());
    return { data };
  }

  @Get('perfil')
  async perfil(@OrgCtx() ctx: OrgContext) {
    const data = await this.authService.perfil(ctx);
    return { data };
  }

  @Post('cambiar-password')
  async cambiarPassword(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.authService.cambiarPassword(ctx, body);
    return { data };
  }

  @Post('sucursal-activa')
  async sucursalActiva(@OrgCtx() ctx: OrgContext, @Body() body: unknown) {
    const data = await this.authService.sucursalActiva(ctx, body);
    return { data };
  }
}
