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
import { CotizacionesController } from './cotizaciones.controller';
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
    ]),
  ],
  controllers: [PrecotizacionesController, CotizacionesController],
  providers: [
    PrecotizacionesService,
    ExtraccionIaService,
    ResolucionCatalogoService,
    {
      provide: PROVEEDOR_IA_TOKEN,
      useFactory: crearProveedorIa,
    },
  ],
  exports: [PrecotizacionesService],
})
export class PrecotizacionesModule {}
