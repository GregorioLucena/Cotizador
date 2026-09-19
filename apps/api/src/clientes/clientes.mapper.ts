import type { Cliente, ListaPrecio } from '@cotizador/database';

export type ClienteDetalleDto = {
  id: string;
  nombre: string;
  telefonoWhatsapp: string | null;
  email: string | null;
  identificacionFiscal: string | null;
  listaPrecio: { id: string; codigo: string; nombre: string } | null;
  direccion: string | null;
  notas: string | null;
  estadoRegistro: string;
  updatedAt: string;
  createdAt: string;
  advertencias?: string[];
  cotizacionesRecientes?: CotizacionResumenDto[];
};

export type CotizacionResumenDto = {
  id: string;
  folio: string;
  estado: string;
  total: string;
  createdAt: string;
};

export function mapCliente(
  cliente: Cliente,
  opciones?: {
    advertencias?: string[];
    cotizacionesRecientes?: CotizacionResumenDto[];
    incluirCotizaciones?: boolean;
  },
): ClienteDetalleDto {
  const lista = cliente.listaPrecio as ListaPrecio | null | undefined;
  const dto: ClienteDetalleDto = {
    id: cliente.id,
    nombre: cliente.nombre,
    telefonoWhatsapp: cliente.telefonoWhatsapp ?? null,
    email: cliente.email ?? null,
    identificacionFiscal: cliente.identificacionFiscal ?? null,
    listaPrecio: lista
      ? { id: lista.id, codigo: lista.codigo, nombre: lista.nombre }
      : null,
    direccion: cliente.direccion ?? null,
    notas: cliente.notas ?? null,
    estadoRegistro: cliente.estadoRegistro,
    updatedAt: cliente.updatedAt.toISOString(),
    createdAt: cliente.createdAt.toISOString(),
  };
  if (opciones?.advertencias?.length) {
    dto.advertencias = opciones.advertencias;
  }
  if (opciones?.incluirCotizaciones) {
    dto.cotizacionesRecientes = opciones.cotizacionesRecientes ?? [];
  }
  return dto;
}
