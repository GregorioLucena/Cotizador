/** Tipos compartidos de la UI de plataforma / organizaciones. */

export type OrganizacionDetalle = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  identificacionFiscal: string | null;
  vertical: { id: string; codigo: string; nombre: string };
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

export type ProvisionamientoResumen = {
  verticalCodigo: string;
  packVersion: string;
  sucursalPrincipalId: string | null;
  listaPrecioPredeterminadaId: string | null;
  plantillaDocumentoId: string | null;
  unidadesMedidaCreadas: number;
  definicionesAtributoCreadas: number;
  categoriasCreadas: number;
};

export type UsuarioOrgResumen = {
  id: string;
  nombreCompleto: string;
  email: string;
  estadoRegistro: string;
  esAdministrador: boolean;
  createdAt: string;
};

export type OrganizacionDetalleRespuesta = {
  organizacion: OrganizacionDetalle;
  provisionamiento: ProvisionamientoResumen;
  usuarios: UsuarioOrgResumen[];
  tieneAdministrador: boolean;
};

export type UsuarioInicialResultado = {
  usuarioId: string;
  email: string;
  passwordTemporal: string;
  debeCambiarPassword: true;
  perfiles: string[];
  sucursalIds: string[];
};

export type VerticalOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

export type MonedaOpcion = {
  id: string;
  codigoIso: string;
  nombre: string;
  simbolo: string;
};
