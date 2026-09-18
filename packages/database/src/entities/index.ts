export { BaseEntity } from './base.entity';
export { Vertical } from './vertical.entity';
export { Moneda } from './moneda.entity';
export { Permiso } from './permiso.entity';
export { Perfil } from './perfil.entity';
export { PerfilPermiso } from './perfil-permiso.entity';
export { Usuario } from './usuario.entity';
export { UsuarioPerfil } from './usuario-perfil.entity';

import { Vertical } from './vertical.entity';
import { Moneda } from './moneda.entity';
import { Permiso } from './permiso.entity';
import { Perfil } from './perfil.entity';
import { PerfilPermiso } from './perfil-permiso.entity';
import { Usuario } from './usuario.entity';
import { UsuarioPerfil } from './usuario-perfil.entity';

export const entities = [
  Vertical,
  Moneda,
  Permiso,
  Perfil,
  PerfilPermiso,
  Usuario,
  UsuarioPerfil,
];
