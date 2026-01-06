import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('saved_items')
export class SavedItem {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', name: 'user_id' })
  @Index('idx_saved_user')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', name: 'item_saved' })
  @Index('idx_saved_item_identifier')
  itemSaved: string;

  @Column({ type: 'varchar', name: 'item_type', nullable: true })
  itemType?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  @Index('idx_saved_created_at')
  createdAt: Date;
}
