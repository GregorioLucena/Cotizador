import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Categoria,
  DefinicionAtributo,
  Item,
  ItemAlias,
  Marca,
  UnidadMedida,
} from '@cotizador/database';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { DefinicionesAtributoController } from './definiciones-atributo.controller';
import { DefinicionesAtributoService } from './definiciones-atributo.service';
import { ItemsUsoHelper } from './items-uso.helper';
import { MarcasController } from './marcas.controller';
import { MarcasService } from './marcas.service';
import { UnidadesMedidaController } from './unidades-medida.controller';
import { UnidadesMedidaService } from './unidades-medida.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UnidadMedida,
      Categoria,
      Marca,
      DefinicionAtributo,
      Item,
      ItemAlias,
    ]),
  ],
  controllers: [
    UnidadesMedidaController,
    CategoriasController,
    MarcasController,
    DefinicionesAtributoController,
  ],
  providers: [
    ItemsUsoHelper,
    UnidadesMedidaService,
    CategoriasService,
    MarcasService,
    DefinicionesAtributoService,
  ],
  exports: [
    UnidadesMedidaService,
    CategoriasService,
    MarcasService,
    DefinicionesAtributoService,
    ItemsUsoHelper,
  ],
})
export class MaestrasModule {}
