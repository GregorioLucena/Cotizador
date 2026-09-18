import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Categoria,
  ConfiguracionCotizacion,
  DefinicionAtributo,
  ListaPrecio,
  Moneda,
  Organizacion,
  Perfil,
  PlantillaDocumento,
  Sesion,
  Sucursal,
  UnidadMedida,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
  Vertical,
} from '@cotizador/database';
import { MonedasController } from './monedas.controller';
import { OrganizacionesController } from './organizaciones.controller';
import { OrganizacionesService } from './organizaciones.service';
import { PlataformaMetricasController } from './plataforma-metricas.controller';
import { ProvisionamientoService } from './provisionamiento.service';
import { VerticalesController } from './verticales.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organizacion,
      Vertical,
      Moneda,
      Sucursal,
      UnidadMedida,
      DefinicionAtributo,
      Categoria,
      ListaPrecio,
      ConfiguracionCotizacion,
      PlantillaDocumento,
      Usuario,
      UsuarioPerfil,
      UsuarioSucursal,
      Perfil,
      Sesion,
    ]),
  ],
  controllers: [
    VerticalesController,
    MonedasController,
    OrganizacionesController,
    PlataformaMetricasController,
  ],
  providers: [OrganizacionesService, ProvisionamientoService],
  exports: [OrganizacionesService],
})
export class OrganizacionesModule {}
