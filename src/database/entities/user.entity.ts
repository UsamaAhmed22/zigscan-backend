import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Index('idx_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Index('idx_users_username', { unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'text', select: false }) // Don't select password by default
  password: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  @Index('idx_users_created_at')
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'last_login', nullable: true })
  @Index('idx_users_last_login')
  lastLogin: Date | null;

  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ type: 'text', name: 'verification_token', nullable: true, select: false })
  verificationToken: string | null;

  @Column({ type: 'text', name: 'reset_token', nullable: true, select: false })
  resetToken: string | null;

  @Column({ type: 'timestamp', name: 'reset_token_expiry', nullable: true, select: false })
  resetTokenExpiry: Date | null;

  @Column({ type: 'timestamp', name: 'last_password_reset_request', nullable: true, select: false })
  lastPasswordResetRequest: Date | null;
}
