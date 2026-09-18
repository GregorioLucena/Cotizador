import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { OrgContext } from '@cotizador/shared';
import { UnauthorizedError } from '@cotizador/shared';

export type AccessTokenPayload = OrgContext & {
  debeCambiarPassword: boolean;
};

@Injectable()
export class TokensService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET no está configurado');
    }
    this.secret = secret;
    this.expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  }

  firmarAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    } as jwt.SignOptions);
  }

  verificarAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
        throw new UnauthorizedError();
      }
      const payload = decoded as AccessTokenPayload;
      if (!payload.usuarioId || !payload.sesionId || !payload.ambito) {
        throw new UnauthorizedError();
      }
      return payload;
    } catch {
      throw new UnauthorizedError();
    }
  }

  generarRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
