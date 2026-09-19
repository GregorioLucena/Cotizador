import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Categoria,
  DefinicionAtributo,
  ImportacionCatalogo,
  Item,
  ItemAlias,
  ListaPrecio,
  Marca,
  PrecioItem,
  UnidadMedida,
} from '@cotizador/database';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { MaestrasModule } from '../maestras/maestras.module';
import { ArchivoParserService } from './archivo-parser.service';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportacionCatalogo,
      PrecioItem,
      Item,
      ItemAlias,
      ListaPrecio,
      UnidadMedida,
      Categoria,
      Marca,
      DefinicionAtributo,
    ]),
    ConfiguracionModule,
    MaestrasModule,
  ],
  controllers: [ImportacionesController],
  providers: [ArchivoParserService, ImportacionesService],
  exports: [ImportacionesService],
})
export class ImportacionesModule {}
