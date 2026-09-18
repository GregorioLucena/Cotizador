import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Sucursal } from './sucursal.entity';
import { Usuario } from './usuario.entity';

@Entity('usuario_sucursales')
@Unique(['usuarioId', 'sucursalId'])
export class UsuarioSucursal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  usuarioId!: string;

  @Column('uuid')
  sucursalId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario!: Usuario;

  @ManyToOne(() => Sucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursalId' })
  sucursal!: Sucursal;
}
