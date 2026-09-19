import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@cotizador/database/entities';
import { AuthModule } from './auth/auth.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { ImportacionesModule } from './importaciones/importaciones.module';
import { ItemsModule } from './items/items.module';
import { MaestrasModule } from './maestras/maestras.module';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';
import { PreciosModule } from './precios/precios.module';
import { SaludModule } from './salud/salud.module';
import { UsuariosModule } from './usuarios/usuarios.module';

function postgresSslOption(): boolean | { rejectUnauthorized: boolean } {
  if (process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  return false;
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: postgresSslOption(),
      entities,
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    SaludModule,
    AuthModule,
    UsuariosModule,
    OrganizacionesModule,
    ConfiguracionModule,
    MaestrasModule,
    ItemsModule,
    ImportacionesModule,
    PreciosModule,
  ],
})
export class AppModule {}
