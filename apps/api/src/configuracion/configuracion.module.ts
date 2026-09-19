import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConfiguracionCotizacion,
  ListaPrecio,
  Moneda,
  Organizacion,
  Sucursal,
  UsuarioSucursal,
} from '@cotizador/database';
import { AlmacenamientoLocalService } from './almacenamiento-local.service';
import { ConfiguracionCotizacionController } from './configuracion-cotizacion.controller';
import { ConfiguracionCotizacionService } from './configuracion-cotizacion.service';
import { ConfiguracionOrganizacionController } from './configuracion-organizacion.controller';
import { ConfiguracionOrganizacionService } from './configuracion-organizacion.service';
import { LogoService } from './logo.service';
import { SucursalesController } from './sucursales.controller';
import { SucursalesService } from './sucursales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organizacion,
      Moneda,
      ListaPrecio,
      Sucursal,
      UsuarioSucursal,
      ConfiguracionCotizacion,
    ]),
  ],
  controllers: [
    ConfiguracionOrganizacionController,
    SucursalesController,
    ConfiguracionCotizacionController,
  ],
  providers: [
    AlmacenamientoLocalService,
    ConfiguracionOrganizacionService,
    LogoService,
    SucursalesService,
    ConfiguracionCotizacionService,
  ],
  exports: [AlmacenamientoLocalService],
})
export class ConfiguracionModule {}
