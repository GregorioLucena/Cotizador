import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cliente,
  ConfiguracionCotizacion,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  CotizacionLineaCandidato,
  DocumentoGenerado,
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
import { ItemsModule } from '../items/items.module';
import { PlantillasModule } from '../plantillas/plantillas.module';
import { IaModule } from '../ia/ia.module';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesRevisionService } from './cotizaciones-revision.service';
import { ExtraccionIaService } from './extraccion-ia.service';
import { PrecotizacionesController } from './precotizaciones.controller';
import { PrecotizacionesService } from './precotizaciones.service';
import { ResolucionCatalogoService } from './resolucion-catalogo.service';

@Module({
  imports: [
    ItemsModule,
    PlantillasModule,
    IaModule,
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
      DocumentoGenerado,
      Moneda,
    ]),
  ],
  controllers: [PrecotizacionesController, CotizacionesController],
  providers: [
    PrecotizacionesService,
    CotizacionesRevisionService,
    ExtraccionIaService,
    ResolucionCatalogoService,
  ],
  exports: [PrecotizacionesService, CotizacionesRevisionService],
})
export class PrecotizacionesModule {}
