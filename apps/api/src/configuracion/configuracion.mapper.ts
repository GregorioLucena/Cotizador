import type {
  ConfiguracionCotizacion,
  ListaPrecio,
  Organizacion,
  Sucursal,
} from '@cotizador/database';

export type MonedaLabel = {
  id: string;
  codigoIso: string;
  nombre: string;
  simbolo: string;
  decimales: number;
};

export type OrganizacionConfiguracionDto = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  identificacionFiscal: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logoUrl: string | null;
  monedaBase: MonedaLabel;
  monedaPresentacion: MonedaLabel | null;
  zonaHoraria: string;
  locale: string;
  usaIa: boolean;
  umbralAutomatico: string;
  umbralDescarte: string;
  estadoRegistro: string;
  createdAt: string;
  updatedAt: string;
};

export type SucursalDto = {
  id: string;
  nombre: string;
  codigo: string | null;
  direccion: string | null;
  telefono: string | null;
  esPrincipal: boolean;
  estadoRegistro: string;
  usuariosAsignados: number;
  createdAt: string;
  updatedAt: string;
};

export type ConfiguracionCotizacionDto = {
  id: string;
  vigenciaHorasPredeterminada: number;
  aplicaImpuesto: boolean;
  porcentajeImpuesto: string;
  preciosIncluyenImpuesto: boolean;
  decimalesRedondeo: number;
  modoRedondeo: string;
  mostrarDescuentoDetallado: boolean;
  permiteSobrescribirPrecio: boolean;
  listaPrecioPredeterminada: {
    id: string;
    nombre: string;
    estadoRegistro: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

function mapMoneda(m: {
  id: string;
  codigoIso: string;
  nombre: string;
  simbolo: string;
  decimales: number;
}): MonedaLabel {
  return {
    id: m.id,
    codigoIso: m.codigoIso,
    nombre: m.nombre,
    simbolo: m.simbolo,
    decimales: m.decimales,
  };
}

/** Respuesta del módulo de configuración: sin notasInternas ni vertical. */
export function mapOrganizacionConfiguracion(
  org: Organizacion,
): OrganizacionConfiguracionDto {
  return {
    id: org.id,
    nombre: org.nombre,
    razonSocial: org.razonSocial ?? null,
    identificacionFiscal: org.identificacionFiscal ?? null,
    telefono: org.telefono ?? null,
    email: org.email ?? null,
    direccion: org.direccion ?? null,
    logoUrl: org.logoUrl ?? null,
    monedaBase: mapMoneda(org.monedaBase),
    monedaPresentacion: org.monedaPresentacion
      ? mapMoneda(org.monedaPresentacion)
      : null,
    zonaHoraria: org.zonaHoraria,
    locale: org.locale,
    usaIa: org.usaIa,
    umbralAutomatico: String(org.umbralAutomatico),
    umbralDescarte: String(org.umbralDescarte),
    estadoRegistro: org.estadoRegistro,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function mapSucursal(
  sucursal: Sucursal,
  usuariosAsignados = 0,
): SucursalDto {
  return {
    id: sucursal.id,
    nombre: sucursal.nombre,
    codigo: sucursal.codigo ?? null,
    direccion: sucursal.direccion ?? null,
    telefono: sucursal.telefono ?? null,
    esPrincipal: sucursal.esPrincipal,
    estadoRegistro: sucursal.estadoRegistro,
    usuariosAsignados,
    createdAt: sucursal.createdAt.toISOString(),
    updatedAt: sucursal.updatedAt.toISOString(),
  };
}

export function mapConfiguracionCotizacion(
  cfg: ConfiguracionCotizacion,
  lista?: ListaPrecio | null,
): ConfiguracionCotizacionDto {
  const listaRef = lista ?? cfg.listaPrecioPredeterminada ?? null;
  return {
    id: cfg.id,
    vigenciaHorasPredeterminada: cfg.vigenciaHorasPredeterminada,
    aplicaImpuesto: cfg.aplicaImpuesto,
    porcentajeImpuesto: String(cfg.porcentajeImpuesto),
    preciosIncluyenImpuesto: cfg.preciosIncluyenImpuesto,
    decimalesRedondeo: cfg.decimalesRedondeo,
    modoRedondeo: cfg.modoRedondeo,
    mostrarDescuentoDetallado: cfg.mostrarDescuentoDetallado,
    permiteSobrescribirPrecio: cfg.permiteSobrescribirPrecio,
    listaPrecioPredeterminada: listaRef
      ? {
          id: listaRef.id,
          nombre: listaRef.nombre,
          estadoRegistro: listaRef.estadoRegistro,
        }
      : null,
    createdAt: cfg.createdAt.toISOString(),
    updatedAt: cfg.updatedAt.toISOString(),
  };
}
