import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cliente,
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  DocumentoGenerado,
  Moneda,
  Organizacion,
  PlantillaDocumento,
  UnidadMedida,
} from '@cotizador/database';
import {
  GENERADOR_PDF_TOKEN,
  GeneradorPdfMock,
  type GeneradorPdf,
} from '@cotizador/shared';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { PlantillasDocumentoController } from './plantillas-documento.controller';
import { PlantillasDocumentoService } from './plantillas-documento.service';

function crearGeneradorPdf(): GeneradorPdf {
  // Mock determinista por defecto. Chromium/puppeteer puede enchufarse
  // detrás de GENERADOR_PDF_TOKEN sin tocar el dominio.
  return new GeneradorPdfMock();
}

@Module({
  imports: [
    ConfiguracionModule,
    TypeOrmModule.forFeature([
      PlantillaDocumento,
      DocumentoGenerado,
      Cotizacion,
      CotizacionLinea,
      CotizacionEvento,
      Organizacion,
      Cliente,
      UnidadMedida,
      Moneda,
    ]),
  ],
  controllers: [PlantillasDocumentoController],
  providers: [
    PlantillasDocumentoService,
    {
      provide: GENERADOR_PDF_TOKEN,
      useFactory: crearGeneradorPdf,
    },
  ],
  exports: [PlantillasDocumentoService, GENERADOR_PDF_TOKEN],
})
export class PlantillasModule {}
