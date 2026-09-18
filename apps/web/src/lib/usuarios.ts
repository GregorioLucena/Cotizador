export type UsuarioDetalle = {
  id: string;
  nombreCompleto: string;
  email: string;
  telefono: string | null;
  debeCambiarPassword: boolean;
  ultimoAccesoAt: string | null;
  estadoRegistro: string;
  perfiles: { id: string; nombre: string; codigo: string }[];
  sucursales: { id: string; nombre: string; esPrincipal: boolean }[];
};

export type PerfilOpcion = {
  id: string;
  nombre: string;
  codigo: string;
  ambito: string;
  descripcion: string | null;
  esSistema: boolean;
};

export type SucursalOpcion = {
  id: string;
  nombre: string;
  codigo: string | null;
  esPrincipal: boolean;
  estadoRegistro: string;
};

export function formatUltimoAcceso(iso: string | null): string {
  if (!iso) return 'Nunca ingresó';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return date.toLocaleDateString('es-VE');
}
