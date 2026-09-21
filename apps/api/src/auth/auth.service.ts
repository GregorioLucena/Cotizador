import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import {
  EstadoRegistro,
  Organizacion,
  Sesion,
  Sucursal,
  Usuario,
} from '@cotizador/database';
import {
  type OrgContext,
  cambiarPasswordSchema,
  credencialesInvalidas,
  loginSchema,
  passwordActualIncorrecta,
  passwordIgualALaAnterior,
  sesionInvalida,
  sucursalActivaSchema,
  sucursalInactiva,
  validarPoliticaPassword,
  contextoOrganizacionRequerido,
  NotFoundError,
} from '@cotizador/shared';
import { ContextoService } from './contexto.service';
import { TokensService } from './tokens.service';

const BCRYPT_ROUNDS = 12;
/** Hash bcrypt de "x" con 12 rondas; solo para igualar tiempos de respuesta. */
const DUMMY_PASSWORD_HASH =
  '$2b$12$OA5uOjU7swhjbHj7xNb2mup5XZwLbMA/kTLnATACR3NTTPMOm2PBS';

const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 7);
const ACCESS_EXPIRES_SECONDS = 900;

export type AuthUsuarioResumen = {
  id: string;
  nombreCompleto: string;
  email: string;
};

export type LoginResultado = {
  accessToken: string;
  expiraEn: number;
  debeCambiarPassword: boolean;
  usuario: AuthUsuarioResumen;
  contexto: OrgContext;
};

export type RefreshResultado = {
  accessToken: string;
  expiraEn: number;
  debeCambiarPassword: boolean;
  usuario: AuthUsuarioResumen;
  contexto: OrgContext;
};

export type CookieRefreshOptions = {
  httpOnly: true;
  path: '/api/auth';
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  secure: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
    @InjectRepository(Organizacion)
    private readonly organizacionRepo: Repository<Organizacion>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    private readonly contextoService: ContextoService,
    private readonly tokensService: TokensService,
  ) {}

  cookieOptions(): CookieRefreshOptions {
    const sameSiteRaw = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
    const sameSite =
      sameSiteRaw === 'strict' || sameSiteRaw === 'none' ? sameSiteRaw : 'lax';
    return {
      httpOnly: true,
      path: '/api/auth',
      sameSite,
      maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    };
  }

  async login(
    body: unknown,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ resultado: LoginResultado; refreshToken: string }> {
    const input = loginSchema.parse(body);

    const usuario = await this.usuarioRepo.findOne({
      where: { email: input.email },
    });

    const hashParaComparar = usuario?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordOk = await bcrypt.compare(input.password, hashParaComparar);

    if (!usuario || !passwordOk) {
      throw credencialesInvalidas();
    }

    if (usuario.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw credencialesInvalidas();
    }

    if (usuario.organizacionId) {
      const org = await this.organizacionRepo.findOne({
        where: { id: usuario.organizacionId },
      });
      if (!org || org.estadoRegistro !== EstadoRegistro.ACTIVO) {
        throw credencialesInvalidas();
      }
    }

    const refreshToken = this.tokensService.generarRefreshToken();
    const sesion = this.sesionRepo.create({
      usuarioId: usuario.id,
      refreshTokenHash: this.tokensService.hashRefreshToken(refreshToken),
      expiraAt: this.fechaExpiracionRefresh(),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    });
    await this.sesionRepo.save(sesion);

    const contexto = await this.contextoService.construir(usuario.id, sesion.id);
    const accessToken = this.tokensService.firmarAccessToken({
      ...contexto,
      debeCambiarPassword: usuario.debeCambiarPassword,
    });

    usuario.ultimoAccesoAt = new Date();
    await this.usuarioRepo.save(usuario);

    return {
      refreshToken,
      resultado: {
        accessToken,
        expiraEn: ACCESS_EXPIRES_SECONDS,
        debeCambiarPassword: usuario.debeCambiarPassword,
        usuario: {
          id: usuario.id,
          nombreCompleto: usuario.nombreCompleto,
          email: usuario.email,
        },
        contexto,
      },
    };
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{ resultado: RefreshResultado; refreshToken: string }> {
    if (!refreshToken) {
      throw sesionInvalida();
    }

    const hash = this.tokensService.hashRefreshToken(refreshToken);
    const sesion = await this.sesionRepo.findOne({
      where: {
        refreshTokenHash: hash,
        revocadaAt: IsNull(),
        expiraAt: MoreThan(new Date()),
      },
    });

    if (!sesion) {
      throw sesionInvalida();
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: sesion.usuarioId },
    });

    if (!usuario || usuario.estadoRegistro !== EstadoRegistro.ACTIVO) {
      sesion.revocadaAt = new Date();
      await this.sesionRepo.save(sesion);
      throw sesionInvalida();
    }

    if (usuario.organizacionId) {
      const org = await this.organizacionRepo.findOne({
        where: { id: usuario.organizacionId },
      });
      if (!org || org.estadoRegistro !== EstadoRegistro.ACTIVO) {
        sesion.revocadaAt = new Date();
        await this.sesionRepo.save(sesion);
        throw sesionInvalida();
      }
    }

    sesion.revocadaAt = new Date();
    await this.sesionRepo.save(sesion);

    const nuevoRefresh = this.tokensService.generarRefreshToken();
    const nuevaSesion = this.sesionRepo.create({
      usuarioId: usuario.id,
      refreshTokenHash: this.tokensService.hashRefreshToken(nuevoRefresh),
      expiraAt: this.fechaExpiracionRefresh(),
      userAgent: sesion.userAgent ?? null,
      ip: sesion.ip ?? null,
    });
    await this.sesionRepo.save(nuevaSesion);

    const contexto = await this.contextoService.construir(usuario.id, nuevaSesion.id);
    const accessToken = this.tokensService.firmarAccessToken({
      ...contexto,
      debeCambiarPassword: usuario.debeCambiarPassword,
    });

    return {
      refreshToken: nuevoRefresh,
      resultado: {
        accessToken,
        expiraEn: ACCESS_EXPIRES_SECONDS,
        debeCambiarPassword: usuario.debeCambiarPassword,
        usuario: {
          id: usuario.id,
          nombreCompleto: usuario.nombreCompleto,
          email: usuario.email,
        },
        contexto,
      },
    };
  }

  async logout(ctx: OrgContext): Promise<{ ok: true }> {
    if (ctx.sesionId) {
      const sesion = await this.sesionRepo.findOne({
        where: { id: ctx.sesionId, revocadaAt: IsNull() },
      });
      if (sesion) {
        sesion.revocadaAt = new Date();
        await this.sesionRepo.save(sesion);
      }
    }
    return { ok: true };
  }

  async perfil(ctx: OrgContext) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: ctx.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundError('USUARIO_NO_ENCONTRADO', 'No se encontró el usuario indicado.');
    }

    let organizacion: { id: string; nombre: string } | null = null;
    if (ctx.organizacionId) {
      const org = await this.organizacionRepo.findOne({
        where: { id: ctx.organizacionId },
      });
      if (org) {
        organizacion = { id: org.id, nombre: org.nombre };
      }
    }

    let sucursalActiva: { id: string; nombre: string } | null = null;
    if (ctx.sucursalActivaId) {
      const sucursal = await this.sucursalRepo.findOne({
        where: { id: ctx.sucursalActivaId },
      });
      if (sucursal) {
        sucursalActiva = { id: sucursal.id, nombre: sucursal.nombre };
      }
    }

    return {
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        email: usuario.email,
        telefono: usuario.telefono ?? null,
        debeCambiarPassword: usuario.debeCambiarPassword,
        ultimoAccesoAt: usuario.ultimoAccesoAt ?? null,
        estadoRegistro: usuario.estadoRegistro,
      },
      contexto: ctx,
      organizacion,
      sucursalActiva,
    };
  }

  async cambiarPassword(
    ctx: OrgContext,
    body: unknown,
  ): Promise<{ ok: true; accessToken: string; debeCambiarPassword: false }> {
    const input = cambiarPasswordSchema.parse(body);
    const usuario = await this.usuarioRepo.findOne({
      where: { id: ctx.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundError('USUARIO_NO_ENCONTRADO', 'No se encontró el usuario indicado.');
    }

    const actualOk = await bcrypt.compare(input.passwordActual, usuario.passwordHash);
    if (!actualOk) {
      throw passwordActualIncorrecta();
    }

    validarPoliticaPassword(input.passwordNueva, {
      email: usuario.email,
      nombreCompleto: usuario.nombreCompleto,
    });

    const igual = await bcrypt.compare(input.passwordNueva, usuario.passwordHash);
    if (igual) {
      throw passwordIgualALaAnterior();
    }

    usuario.passwordHash = await bcrypt.hash(input.passwordNueva, BCRYPT_ROUNDS);
    usuario.debeCambiarPassword = false;
    await this.usuarioRepo.save(usuario);

    await this.sesionRepo.update(
      { usuarioId: usuario.id, id: Not(ctx.sesionId), revocadaAt: IsNull() },
      { revocadaAt: new Date() },
    );

    const contexto = await this.contextoService.construir(
      usuario.id,
      ctx.sesionId,
      ctx.sucursalActivaId,
    );
    const accessToken = this.tokensService.firmarAccessToken({
      ...contexto,
      debeCambiarPassword: false,
    });

    return { ok: true, accessToken, debeCambiarPassword: false };
  }

  async sucursalActiva(
    ctx: OrgContext,
    body: unknown,
  ): Promise<{ accessToken: string; contexto: OrgContext }> {
    if (!ctx.organizacionId) {
      throw contextoOrganizacionRequerido();
    }

    const input = sucursalActivaSchema.parse(body);

    if (!ctx.sucursalIds.includes(input.sucursalId)) {
      throw new NotFoundError();
    }

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: input.sucursalId },
    });

    if (!sucursal || sucursal.organizacionId !== ctx.organizacionId) {
      throw new NotFoundError();
    }

    if (sucursal.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw sucursalInactiva();
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: ctx.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundError('USUARIO_NO_ENCONTRADO', 'No se encontró el usuario indicado.');
    }

    const contexto = await this.contextoService.construir(
      usuario.id,
      ctx.sesionId,
      input.sucursalId,
    );

    const accessToken = this.tokensService.firmarAccessToken({
      ...contexto,
      debeCambiarPassword: usuario.debeCambiarPassword,
    });

    return { accessToken, contexto };
  }

  private fechaExpiracionRefresh(): Date {
    const d = new Date();
    d.setDate(d.getDate() + REFRESH_DAYS);
    return d;
  }
}
