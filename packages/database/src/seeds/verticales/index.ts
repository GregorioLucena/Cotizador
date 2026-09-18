import { packAutomotriz } from './automotriz';
import { packFerreteria } from './ferreteria';
import { packGenerico } from './generico';
import { packRepuestos } from './repuestos';
import {
  PACK_VERSION,
  type CodigoVertical,
  type PackResumen,
  type PackVertical,
} from './tipos';

export { PACK_VERSION };
export type {
  CampoColumnaPlantilla,
  CodigoVertical,
  ModoRedondeoPack,
  PackCategoria,
  PackColumnaPlantilla,
  PackConfiguracionCotizacion,
  PackDefinicionAtributo,
  PackPlantillaDocumento,
  PackResumen,
  PackSinonimo,
  PackUnidadMedida,
  PackVertical,
  TipoDatoPack,
} from './tipos';
export { plantillaBase } from './tipos';

export const packsPorCodigo: Record<CodigoVertical, PackVertical> = {
  FERRETERIA: packFerreteria,
  REPUESTOS: packRepuestos,
  AUTOMOTRIZ: packAutomotriz,
  GENERICO: packGenerico,
};

export function getPack(codigo: CodigoVertical): PackVertical {
  const pack = packsPorCodigo[codigo];
  if (!pack) {
    throw new Error(`Pack de vertical no encontrado: ${codigo}`);
  }
  return pack;
}

function contarSubcategorias(pack: PackVertical): number {
  return pack.categorias.reduce(
    (acc, cat) => acc + (cat.subcategorias?.length ?? 0),
    0,
  );
}

export function listarPacksResumen(): PackResumen[] {
  return Object.values(packsPorCodigo).map((pack) => ({
    codigo: pack.codigo,
    nombre: pack.nombre,
    usaAplicaciones: pack.usaAplicaciones,
    conteos: {
      unidadesMedida: pack.unidadesMedida.length,
      definicionesAtributo: pack.definicionesAtributo.length,
      categorias: pack.categorias.length,
      subcategorias: contarSubcategorias(pack),
      sinonimos: pack.sinonimos.length,
    },
  }));
}

export {
  packAutomotriz,
  packFerreteria,
  packGenerico,
  packRepuestos,
};
