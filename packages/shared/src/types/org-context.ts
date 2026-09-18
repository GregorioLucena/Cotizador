export type OrgContext = {
  usuarioId: string;
  organizacionId: string | null;
  ambito: 'PLATAFORMA' | 'ORGANIZACION';
  sucursalIds: string[];
  sucursalActivaId?: string;
  permisos: string[];
  sesionId: string;
};
