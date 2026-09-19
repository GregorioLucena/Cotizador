import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CanalSolicitud, EstadoSolicitud } from '../enums';
import { BaseEntity } from './base.entity';
import { Cliente } from './cliente.entity';
import { Organizacion } from './organizacion.entity';
import { Sucursal } from './sucursal.entity';

@Entity('solicitudes')
export class Solicitud extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column({ type: 'uuid', nullable: true })
  sucursalId?: string | null;

  @ManyToOne(() => Sucursal, { nullable: true })
  @JoinColumn({ name: 'sucursalId' })
  sucursal?: Sucursal | null;

  @Column({ type: 'uuid', nullable: true })
  clienteId?: string | null;

  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente?: Cliente | null;

  @Column({
    type: 'enum',
    enum: CanalSolicitud,
    default: CanalSolicitud.WHATSAPP_PEGADO,
  })
  canal!: CanalSolicitud;

  @Column({ type: 'text' })
  textoOriginal!: string;

  @Column({ type: 'text' })
  textoNormalizado!: string;

  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado!: EstadoSolicitud;

  @Column({ type: 'timestamptz' })
  recibidaAt!: Date;
}
