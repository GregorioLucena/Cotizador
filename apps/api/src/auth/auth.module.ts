import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Organizacion,
  Perfil,
  PerfilPermiso,
  Permiso,
  Sesion,
  Sucursal,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
} from '@cotizador/database';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ContextoService } from './contexto.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Sesion,
      UsuarioPerfil,
      UsuarioSucursal,
      Perfil,
      PerfilPermiso,
      Permiso,
      Sucursal,
      Organizacion,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    ContextoService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthService, ContextoService, TokensService],
})
export class AuthModule {}
