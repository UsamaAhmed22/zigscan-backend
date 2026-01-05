import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../auth/enums/user-role.enum';
import { User } from './user.entity';

@Entity('api_keys')
@Index('idx_api_keys_owner', ['ownerId'])
@Index('idx_api_keys_is_active', ['isActive'])
export class ApiKey {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'owner_id', type: 'bigint', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner?: User | null;

  @Index('idx_api_keys_key_hash', { unique: true })
  @Column({ name: 'key_hash', type: 'varchar', length: 130, unique: true })
  keyHash: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @Column({ name: 'time_restricted', type: 'boolean', default: () => 'false' })
  timeRestricted: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: () => 'true' })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'request_count', type: 'bigint', default: () => '0' })
  requestCount: string;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
