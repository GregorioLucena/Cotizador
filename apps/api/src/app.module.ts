import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '@cotizador/database/entities';
import { AuthModule } from './auth/auth.module';
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
  ],
})
export class AppModule {}
