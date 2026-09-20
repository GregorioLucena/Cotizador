import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PromptVersion,
  Solicitud,
  Vertical,
} from '@cotizador/database';
import {
  PROVEEDOR_IA_TOKEN,
  ProveedorIaMock,
  ProveedorIaNone,
} from '@cotizador/shared';
import { crearProveedorIaOpenAIDesdeEnv } from './proveedor-openai';
import { PromptVersionesService } from './prompt-versiones.service';
import { PlataformaIaController } from './plataforma-ia.controller';

function crearProveedorIa() {
  const nombre = (process.env.IA_PROVEEDOR ?? 'mock').toLowerCase();
  if (nombre === 'none') return new ProveedorIaNone();
  if (nombre === 'openai') return crearProveedorIaOpenAIDesdeEnv();
  return new ProveedorIaMock();
}

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptVersion, Solicitud, Vertical]),
  ],
  controllers: [PlataformaIaController],
  providers: [
    PromptVersionesService,
    {
      provide: PROVEEDOR_IA_TOKEN,
      useFactory: crearProveedorIa,
    },
  ],
  exports: [PromptVersionesService, PROVEEDOR_IA_TOKEN],
})
export class IaModule {}
