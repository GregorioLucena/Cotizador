import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Organizacion } from './organizacion.entity';

@Entity('secuencias_folio')
@Unique(['organizacionId'])
export class SecuenciaFolio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @OneToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column({ type: 'int', default: 0 })
  ultimoNumero!: number;
}
