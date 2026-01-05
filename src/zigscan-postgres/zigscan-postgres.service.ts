import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';
import { AppConfiguration } from '../config/configuration';

@Injectable()
export class ZigscanPostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZigscanPostgresService.name);
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const config =
      this.configService.getOrThrow<AppConfiguration['zigscanPostgres']>('zigscanPostgres');

    if (!config.database) {
      this.logger.warn(
        'ZIGSCAN_POSTGRES_DATABASE is not set; skipping ZigScan Postgres connection',
      );
      return;
    }

    const sshEnabled = this.configService.get<string>('SSH_TUNNEL_ENABLED', 'false') === 'true';
    if (sshEnabled) {
      this.logger.log('Waiting for SSH tunnel before connecting to ZigScan Postgres...');
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl
        ? {
            rejectUnauthorized: false,
          }
        : false,
    });

    try {
      await this.pool.query('SELECT 1');
      this.logger.log(`Connected to ZigScan Postgres database (${config.database})`);
    } catch (error) {
      this.logger.error('Failed to connect to ZigScan Postgres', error);
      await this.pool.end();
      this.pool = null;
      throw error;
    }
  }

  async query<T = Record<string, unknown>>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('ZigScan Postgres pool is not configured');
    }
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.logger.log('Closed ZigScan Postgres pool');
    }
  }
}
