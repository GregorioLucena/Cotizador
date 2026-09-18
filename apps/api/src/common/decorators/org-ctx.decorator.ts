import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { OrgContext } from '@cotizador/shared';
import { UnauthorizedError } from '@cotizador/shared';
import type { Request } from 'express';

export const OrgCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const orgContext = request.orgContext;
    if (!orgContext) {
      throw new UnauthorizedError();
    }
    return orgContext;
  },
);
