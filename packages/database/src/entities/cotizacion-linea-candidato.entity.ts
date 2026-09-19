import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrigenMatch } from '../enums';
import { CotizacionLinea } from './cotizacion-linea.entity';
import { Item } from './item.entity';
import { Organizacion } from './organizacion.entity';

@Entity('cotizacion_linea_candidatos')
export class CotizacionLineaCandidato {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizacionId!: string;

  @ManyToOne(() => Organizacion)
  @JoinColumn({ name: 'organizacionId' })
  organizacion!: Organizacion;

  @Column('uuid')
  cotizacionLineaId!: string;

  @ManyToOne(() => CotizacionLinea)
  @JoinColumn({ name: 'cotizacionLineaId' })
  cotizacionLinea!: CotizacionLinea;

  @Column('uuid')
  itemId!: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  puntaje!: string;

  @Column({ type: 'enum', enum: OrigenMatch })
  origenMatch!: OrigenMatch;

  @Column({ type: 'int' })
  orden!: number;
}
