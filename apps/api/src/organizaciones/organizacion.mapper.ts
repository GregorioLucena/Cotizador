import type { Organizacion } from '@cotizador/database';

export type OrganizacionDetalle = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  identificacionFiscal: string | null;
  vertical: {
    id: string;
    codigo: string;
    nombre: string;
  };
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logoUrl: string | null;
  monedaBase: {
    id: string;
    codigoIso: string;
    nombre: string;
    simbolo: string;
    decimales: number;
  };
  monedaPresentacion: {
    id: string;
    codigoIso: string;
    nombre: string;
    simbolo: string;
    decimales: number;
  } | null;
  zonaHoraria: string;
  locale: string;
  usaIa: boolean;
  umbralAutomatico: string;
  umbralDescarte: string;
  notasInternas: string | null;
  estadoRegistro: string;
  createdAt: string;
  updatedAt: string;
};

export function mapOrganizacionDetalle(org: Organizacion): OrganizacionDetalle {
  return {
    id: org.id,
    nombre: org.nombre,
    razonSocial: org.razonSocial ?? null,
    identificacionFiscal: org.identificacionFiscal ?? null,
    vertical: {
      id: org.vertical.id,
      codigo: org.vertical.codigo,
      nombre: org.vertical.nombre,
    },
    telefono: org.telefono ?? null,
    email: org.email ?? null,
    direccion: org.direccion ?? null,
    logoUrl: org.logoUrl ?? null,
    monedaBase: {
      id: org.monedaBase.id,
      codigoIso: org.monedaBase.codigoIso,
      nombre: org.monedaBase.nombre,
      simbolo: org.monedaBase.simbolo,
      decimales: org.monedaBase.decimales,
    },
    monedaPresentacion: org.monedaPresentacion
      ? {
          id: org.monedaPresentacion.id,
          codigoIso: org.monedaPresentacion.codigoIso,
          nombre: org.monedaPresentacion.nombre,
          simbolo: org.monedaPresentacion.simbolo,
          decimales: org.monedaPresentacion.decimales,
        }
      : null,
    zonaHoraria: org.zonaHoraria,
    locale: org.locale,
    usaIa: org.usaIa,
    umbralAutomatico: String(org.umbralAutomatico),
    umbralDescarte: String(org.umbralDescarte),
    notasInternas: org.notasInternas ?? null,
    estadoRegistro: org.estadoRegistro,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}
