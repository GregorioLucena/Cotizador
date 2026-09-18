import type { OrgContext } from '@cotizador/shared';

declare global {
  namespace Express {
    interface Request {
      orgContext?: OrgContext;
      debeCambiarPassword?: boolean;
    }
  }
}

export {};
