import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  UnauthorizedError,
  cambioPasswordRequerido,
  type OrgContext,
} from '@cotizador/shared';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/publico.decorator';
import { TokensService } from '../../auth/tokens.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokensService: TokensService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedError();
    }

    let payload: OrgContext & { debeCambiarPassword: boolean };
    try {
      payload = this.tokensService.verificarAccessToken(token);
    } catch {
      throw new UnauthorizedError();
    }

    const {
      debeCambiarPassword,
      usuarioId,
      organizacionId,
      ambito,
      sucursalIds,
      sucursalActivaId,
      permisos,
      sesionId,
    } = payload;

    const orgContext: OrgContext = {
      usuarioId,
      organizacionId,
      ambito,
      sucursalIds,
      sucursalActivaId,
      permisos,
      sesionId,
    };

    request.orgContext = orgContext;
    request.debeCambiarPassword = debeCambiarPassword;

    if (debeCambiarPassword) {
      const method = request.method.toUpperCase();
      const path = (request.originalUrl ?? request.url ?? '').split('?')[0] ?? '';
      const permitido =
        (method === 'GET' && path.endsWith('/auth/perfil')) ||
        (method === 'POST' && path.endsWith('/auth/cambiar-password')) ||
        (method === 'POST' && path.endsWith('/auth/logout'));
      if (!permitido) {
        throw cambioPasswordRequerido();
      }
    }

    return true;
  }
}
