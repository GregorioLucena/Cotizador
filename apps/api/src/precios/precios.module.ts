import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Categoria,
  ConfiguracionCotizacion,
  Item,
  ListaPrecio,
  Marca,
  Moneda,
  Organizacion,
  PrecioItem,
  ReglaDescuento,
  TasaCambio,
} from '@cotizador/database';
import { ListasPrecioController } from './listas-precio.controller';
import { ListasPrecioService } from './listas-precio.service';
import { ReglasDescuentoController } from './reglas-descuento.controller';
import { ReglasDescuentoService } from './reglas-descuento.service';
import { TasasCambioController } from './tasas-cambio.controller';
import { TasasCambioService } from './tasas-cambio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ListaPrecio,
      PrecioItem,
      ReglaDescuento,
      TasaCambio,
      Item,
      Categoria,
      Marca,
      Moneda,
      Organizacion,
      ConfiguracionCotizacion,
    ]),
  ],
  controllers: [
    ListasPrecioController,
    ReglasDescuentoController,
    TasasCambioController,
  ],
  providers: [ListasPrecioService, ReglasDescuentoService, TasasCambioService],
  exports: [ListasPrecioService, ReglasDescuentoService, TasasCambioService],
})
export class PreciosModule {}
