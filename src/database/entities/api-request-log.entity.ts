import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('api_request_logs')
@Index('idx_api_request_logs_key_time', ['apiKeyId', 'createdAt'])
@Index('idx_api_request_logs_ip_time', ['ipAddress', 'createdAt'])
@Index('idx_api_request_logs_status_time', ['statusCode', 'createdAt'])
export class ApiRequestLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @PrimaryColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ name: 'api_key_id', type: 'bigint', nullable: true })
  apiKeyId: string | null;

  @Column({ name: 'api_key_prefix', type: 'varchar', length: 16 })
  apiKeyPrefix: string;

  @Column({ name: 'ip_address', type: 'inet' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 8 })
  method: string;

  @Column({ type: 'text' })
  path: string;

  @Column({ name: 'status_code', type: 'smallint' })
  statusCode: number;

  @Column({ name: 'response_ms', type: 'integer' })
  responseMs: number;

  @Column({ name: 'bytes_sent', type: 'integer', default: 0 })
  bytesSent: number;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'text', nullable: true })
  referer: string | null;
}
