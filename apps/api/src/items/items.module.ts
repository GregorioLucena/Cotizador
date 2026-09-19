import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Categoria,
  DefinicionAtributo,
  Item,
  ItemAlias,
  ItemAplicacion,
  Marca,
  TerminoNoResuelto,
  UnidadMedida,
} from '@cotizador/database';
import { MaestrasModule } from '../maestras/maestras.module';
import { AliasService } from './alias.service';
import { AplicacionesService } from './aplicaciones.service';
import { BusquedaService } from './busqueda.service';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { TerminosNoResueltosController } from './terminos-no-resueltos.controller';
import { TerminosNoResueltosService } from './terminos-no-resueltos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Item,
      ItemAlias,
      ItemAplicacion,
      TerminoNoResuelto,
      Categoria,
      Marca,
      UnidadMedida,
      DefinicionAtributo,
    ]),
    MaestrasModule,
  ],
  controllers: [ItemsController, TerminosNoResueltosController],
  providers: [
    ItemsService,
    AliasService,
    AplicacionesService,
    BusquedaService,
    TerminosNoResueltosService,
  ],
  exports: [ItemsService, AliasService, BusquedaService],
})
export class ItemsModule {}
