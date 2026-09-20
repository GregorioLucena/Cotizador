import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cotizacion,
  CotizacionEvento,
  CotizacionLinea,
  Organizacion,
  TerminoNoResuelto,
} from '@cotizador/database';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cotizacion,
      CotizacionLinea,
      CotizacionEvento,
      TerminoNoResuelto,
      Organizacion,
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
