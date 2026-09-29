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
  PdfGeneracionError,
  type GeneradorPdf,
} from '@cotizador/shared';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import {
  GeneradorPdfChromium,
  resolverExecutableChromium,
} from './generador-pdf-chromium';
import { PlantillasDocumentoController } from './plantillas-documento.controller';
import { PlantillasDocumentoService } from './plantillas-documento.service';

function crearGeneradorPdf(): GeneradorPdf {
  const modo = (process.env.PDF_GENERADOR ?? 'auto').toLowerCase();

  if (modo === 'mock') {
    return new GeneradorPdfMock();
  }

  const executablePath = resolverExecutableChromium();
  if (executablePath) {
    return new GeneradorPdfChromium(executablePath);
  }

  if (modo === 'chromium') {
    throw new PdfGeneracionError(
      'No se encontró Chromium/Chrome. Defina CHROMIUM_PATH o use PDF_GENERADOR=mock.',
    );
  }

  // auto sin binario: mock (CI / entornos sin navegador)
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
