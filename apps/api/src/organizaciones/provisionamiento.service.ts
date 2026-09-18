import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  Categoria,
  ConfiguracionCotizacion,
  DefinicionAtributo,
  EstadoRegistro,
  ListaPrecio,
  ModoRedondeo,
  Organizacion,
  PACK_VERSION,
  PlantillaDocumento,
  Sucursal,
  TipoDatoAtributo,
  UnidadMedida,
  type PackVertical,
  type ModoRedondeoPack,
} from '@cotizador/database';

export type SucursalPrincipalInput = {
  nombre: string;
  codigo: string;
  direccion?: string;
  telefono?: string;
};

export type ProvisionamientoResumen = {
  verticalCodigo: string;
  packVersion: string;
  sucursalPrincipalId: string;
  listaPrecioPredeterminadaId: string;
  plantillaDocumentoId: string;
  unidadesMedidaCreadas: number;
  definicionesAtributoCreadas: number;
  categoriasCreadas: number;
};

function mapModoRedondeo(modo: ModoRedondeoPack): ModoRedondeo {
  switch (modo) {
    case 'ARRIBA':
      return ModoRedondeo.ARRIBA;
    case 'ABAJO':
      return ModoRedondeo.ABAJO;
    default:
      return ModoRedondeo.NORMAL;
  }
}

function mapTipoDato(tipo: string): TipoDatoAtributo {
  if (tipo in TipoDatoAtributo) {
    return TipoDatoAtributo[tipo as keyof typeof TipoDatoAtributo];
  }
  return TipoDatoAtributo.TEXTO;
}

@Injectable()
export class ProvisionamientoService {
  async provisionar(
    manager: EntityManager,
    org: Organizacion,
    pack: PackVertical,
    sucursalInput: SucursalPrincipalInput | undefined,
    createdById: string,
  ): Promise<ProvisionamientoResumen> {
    const audit = { createdById, updatedById: createdById };

    const sucursal = await manager.save(
      Sucursal,
      manager.create(Sucursal, {
        organizacionId: org.id,
        nombre: sucursalInput?.nombre ?? 'Principal',
        codigo: sucursalInput?.codigo ?? 'PRIN',
        direccion: sucursalInput?.direccion ?? null,
        telefono: sucursalInput?.telefono ?? null,
        esPrincipal: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
        ...audit,
      }),
    );

    const unidades = await manager.save(
      UnidadMedida,
      pack.unidadesMedida.map((u) =>
        manager.create(UnidadMedida, {
          organizacionId: org.id,
          codigo: u.codigo,
          nombre: u.nombre,
          permiteDecimales: u.permiteDecimales,
          estadoRegistro: EstadoRegistro.ACTIVO,
          ...audit,
        }),
      ),
    );

    const definiciones = await manager.save(
      DefinicionAtributo,
      pack.definicionesAtributo.map((d) =>
        manager.create(DefinicionAtributo, {
          organizacionId: org.id,
          codigo: d.codigo,
          etiqueta: d.etiqueta,
          tipoDato: mapTipoDato(d.tipoDato),
          opciones: d.opciones ?? null,
          unidadSugerida: d.unidadSugerida ?? null,
          requerido: d.requerido,
          usarEnBusqueda: d.usarEnBusqueda,
          orden: d.orden,
          estadoRegistro: EstadoRegistro.ACTIVO,
          ...audit,
        }),
      ),
    );

    let categoriasCreadas = 0;
    for (const cat of pack.categorias) {
      const padre = await manager.save(
        Categoria,
        manager.create(Categoria, {
          organizacionId: org.id,
          nombre: cat.nombre,
          categoriaPadreId: null,
          orden: cat.orden,
          estadoRegistro: EstadoRegistro.ACTIVO,
          ...audit,
        }),
      );
      categoriasCreadas += 1;

      for (const sub of cat.subcategorias ?? []) {
        await manager.save(
          Categoria,
          manager.create(Categoria, {
            organizacionId: org.id,
            nombre: sub.nombre,
            categoriaPadreId: padre.id,
            orden: sub.orden,
            estadoRegistro: EstadoRegistro.ACTIVO,
            ...audit,
          }),
        );
        categoriasCreadas += 1;
      }
    }

    const listaPrecio = await manager.save(
      ListaPrecio,
      manager.create(ListaPrecio, {
        organizacionId: org.id,
        nombre: 'General',
        monedaId: org.monedaBaseId,
        esPredeterminada: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
        ...audit,
      }),
    );

    const cfg = pack.configuracionCotizacion;
    await manager.save(
      ConfiguracionCotizacion,
      manager.create(ConfiguracionCotizacion, {
        organizacionId: org.id,
        vigenciaHorasPredeterminada: cfg.vigenciaHorasPredeterminada,
        aplicaImpuesto: cfg.aplicaImpuesto,
        porcentajeImpuesto: cfg.porcentajeImpuesto,
        preciosIncluyenImpuesto: cfg.preciosIncluyenImpuesto,
        decimalesRedondeo: cfg.decimalesRedondeo,
        modoRedondeo: mapModoRedondeo(cfg.modoRedondeo),
        mostrarDescuentoDetallado: cfg.mostrarDescuentoDetallado,
        permiteSobrescribirPrecio: cfg.permiteSobrescribirPrecio,
        listaPrecioPredeterminadaId: listaPrecio.id,
        ...audit,
      }),
    );

    const identidad: Record<string, unknown> = {
      nombreComercial: org.nombre,
    };
    if (org.razonSocial) identidad.razonSocial = org.razonSocial;
    if (org.identificacionFiscal) {
      identidad.identificacionFiscal = org.identificacionFiscal;
    }
    if (org.direccion) identidad.direccion = org.direccion;
    if (org.telefono) identidad.telefonos = [org.telefono];
    else identidad.telefonos = [];
    if (org.email) identidad.email = org.email;
    if (org.logoUrl) identidad.logoUrl = org.logoUrl;

    const plantilla = await manager.save(
      PlantillaDocumento,
      manager.create(PlantillaDocumento, {
        organizacionId: org.id,
        nombre: 'Predeterminada',
        version: 1,
        esPredeterminada: true,
        configuracion: {
          identidad,
          ...pack.plantillaDocumento,
        },
        estadoRegistro: EstadoRegistro.ACTIVO,
        ...audit,
      }),
    );

    return {
      verticalCodigo: pack.codigo,
      packVersion: PACK_VERSION,
      sucursalPrincipalId: sucursal.id,
      listaPrecioPredeterminadaId: listaPrecio.id,
      plantillaDocumentoId: plantilla.id,
      unidadesMedidaCreadas: unidades.length,
      definicionesAtributoCreadas: definiciones.length,
      categoriasCreadas,
    };
  }
}
