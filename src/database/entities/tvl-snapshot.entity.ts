import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('tvl_data')
@Index('idx_tvl_protocol_time', ['entityName', 'createdAt'])
@Index('idx_tvl_value', ['tvlValue'])
export class TvlSnapshot {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column('text', { name: 'entity_name' })
  entityName: string;

  @Column('double precision', { name: 'tvl_value' })
  tvlValue: number;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
