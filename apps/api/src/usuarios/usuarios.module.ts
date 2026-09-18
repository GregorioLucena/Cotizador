import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Perfil,
  Sesion,
  Sucursal,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
} from '@cotizador/database';
import { PerfilesController } from './perfiles.controller';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      UsuarioPerfil,
      UsuarioSucursal,
      Perfil,
      Sucursal,
      Sesion,
    ]),
  ],
  controllers: [UsuariosController, PerfilesController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
