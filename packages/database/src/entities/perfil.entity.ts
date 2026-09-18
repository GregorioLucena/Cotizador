import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AmbitoPerfil, EstadoRegistro } from '../enums';
import { PerfilPermiso } from './perfil-permiso.entity';

@Entity('perfiles')
export class Perfil {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  nombre!: string;

  @Column({ unique: true })
  codigo!: string;

  @Column({ type: 'enum', enum: AmbitoPerfil })
  ambito!: AmbitoPerfil;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @Column({ type: 'boolean', default: false })
  esSistema!: boolean;

  @Column({ type: 'enum', enum: EstadoRegistro, default: EstadoRegistro.ACTIVO })
  estadoRegistro!: EstadoRegistro;

  @OneToMany(() => PerfilPermiso, (pp) => pp.perfil)
  permisos!: PerfilPermiso[];
}
