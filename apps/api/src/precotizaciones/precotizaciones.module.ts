import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cliente,
  ConfiguracionCotizacion,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  CotizacionLineaCandidato,
  InterpretacionSolicitud,
  Item,
  ItemAlias,
  ListaPrecio,
  Moneda,
  Organizacion,
  PlantillaDocumento,
  PrecioItem,
  ReglaDescuento,
  SecuenciaFolio,
  Solicitud,
  TasaCambio,
  TerminoNoResuelto,
  UnidadMedida,
} from '@cotizador/database';
import {
  PROVEEDOR_IA_TOKEN,
  ProveedorIaMock,
  ProveedorIaNone,
} from '@cotizador/shared';
import { ItemsModule } from '../items/items.module';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesRevisionService } from './cotizaciones-revision.service';
import { ExtraccionIaService } from './extraccion-ia.service';
import { PrecotizacionesController } from './precotizaciones.controller';
import { PrecotizacionesService } from './precotizaciones.service';
import { ResolucionCatalogoService } from './resolucion-catalogo.service';

function crearProveedorIa() {
  const nombre = (process.env.IA_PROVEEDOR ?? 'mock').toLowerCase();
  if (nombre === 'none') return new ProveedorIaNone();
  return new ProveedorIaMock();
}

@Module({
  imports: [
    ItemsModule,
    TypeOrmModule.forFeature([
      Solicitud,
      InterpretacionSolicitud,
      SecuenciaFolio,
      Cotizacion,
      CotizacionLinea,
      CotizacionLineaCandidato,
      CotizacionEvento,
      Cliente,
      ListaPrecio,
      Item,
      ItemAlias,
      PrecioItem,
      ReglaDescuento,
      TasaCambio,
      TerminoNoResuelto,
      UnidadMedida,
      Organizacion,
      ConfiguracionCotizacion,
      PlantillaDocumento,
      Moneda,
    ]),
  ],
  controllers: [PrecotizacionesController, CotizacionesController],
  providers: [
    PrecotizacionesService,
    CotizacionesRevisionService,
    ExtraccionIaService,
    ResolucionCatalogoService,
    {
      provide: PROVEEDOR_IA_TOKEN,
      useFactory: crearProveedorIa,
    },
  ],
  exports: [PrecotizacionesService, CotizacionesRevisionService],
})
export class PrecotizacionesModule {}
