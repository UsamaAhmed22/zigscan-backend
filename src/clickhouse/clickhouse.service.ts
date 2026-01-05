import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse, isAxiosError } from 'axios';
import { AppConfiguration } from '../config/configuration';
import { SshTunnelService } from '../database/ssh-tunnel.service';
import { MetricsService } from '../metrics/metrics.service';

interface ClickHouseConnection {
  client: AxiosInstance;
  database: string;
  url: string;
  isPrimary: boolean;
}

@Injectable()
export class ClickhouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickhouseService.name);
  private readonly connections: ClickHouseConnection[] = [];
  private currentConnectionIndex = 0;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SshTunnelService))
    private readonly sshTunnelService: SshTunnelService,
    private readonly metricsService: MetricsService,
  ) {
    const config = this.configService.getOrThrow<AppConfiguration['clickhouse']>('clickhouse');

    // Parse comma-separated URLs and databases
    const urls = config.url.split(',').map(u => u.trim());
    const databases = config.database.split(',').map(d => d.trim());

    // Create connection for each URL/database pair
    urls.forEach((url, index) => {
      const database = databases[index] || databases[0]; // Use first database as fallback
      const client = axios.create({
        baseURL: url,
        auth: {
          username: config.username,
          password: config.password,
        },
        timeout: 120_000,
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      this.connections.push({
        client,
        database,
        url,
        isPrimary: index === 0,
      });
    });

    this.logger.log(`Initialized ClickHouse service with ${this.connections.length} connection(s)`);
    if (this.connections.length > 1) {
      this.logger.log(`Fallback connections available: ${this.connections.length - 1}`);
    }
  }

  async onModuleInit(): Promise<void> {
    const sshEnabled = this.configService.get<string>('SSH_TUNNEL_ENABLED', 'false') === 'true';
    if (sshEnabled) {
      this.logger.log('Waiting for SSH tunnel to establish before using ClickHouse...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  private async executeQueryWithConnection<T>(
    connection: ClickHouseConnection,
    sql: string,
  ): Promise<T[]> {
    const response: AxiosResponse<{ data?: T[] }> = await connection.client.post('', sql, {
      params: {
        database: connection.database,
        default_format: 'JSON',
      },
    });

    return response.data?.data ?? [];
  }

  async executeQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    let lastError: Error | null = null;

    // Try each connection in order
    for (let i = 0; i < this.connections.length; i++) {
      const connectionIndex = (this.currentConnectionIndex + i) % this.connections.length;
      const connection = this.connections[connectionIndex];

      try {
        const result = await this.executeQueryWithConnection<T>(connection, sql);

        // Log if we switched to a fallback connection
        if (!connection.isPrimary && i === 0) {
          this.logger.warn(
            `⚠️  Using ${connection.isPrimary ? 'PRIMARY' : 'FALLBACK'} ClickHouse connection: ${connection.database}`,
          );
        }

        // If this was a fallback and it succeeded, keep using it
        if (i > 0) {
          this.currentConnectionIndex = connectionIndex;
          this.logger.warn(
            `✓ Switched to ${connection.isPrimary ? 'PRIMARY' : 'FALLBACK'} connection (${connection.database}) after primary failed`,
          );
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const errorDetail =
          isAxiosError(error) && error.response
            ? typeof error.response.data === 'string'
              ? error.response.data
              : JSON.stringify(error.response.data)
            : lastError.message;

        this.logger.error(
          `✗ ClickHouse ${connection.isPrimary ? 'PRIMARY' : 'FALLBACK'} connection failed (${connection.database}): ${errorDetail}`,
        );
        this.metricsService.incrementClickhouseFailure(
          connection.isPrimary ? 'primary' : 'fallback',
        );

        // If this is not the last connection, try the next one
        if (i < this.connections.length - 1) {
          this.logger.warn(
            `→ Attempting ${this.connections[(connectionIndex + 1) % this.connections.length].isPrimary ? 'PRIMARY' : 'FALLBACK'} connection...`,
          );
        }
      }
    }

    // All connections failed
    this.logger.error(
      `❌ ALL ClickHouse connections failed! Tried ${this.connections.length} connection(s)`,
    );

    if (isAxiosError(lastError) && lastError.response) {
      const statusCode = lastError.response.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        `All ClickHouse connections failed. Last error: ${lastError.message}`,
        statusCode,
      );
    }

    throw new HttpException(
      `All ClickHouse connections failed. Last error: ${lastError?.message || 'Unknown error'}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async healthCheck(): Promise<{ status: string; error?: string; activeConnection?: string }> {
    try {
      await this.executeQuery('SELECT 1');
      const activeConnection = this.connections[this.currentConnectionIndex];
      return {
        status: 'healthy',
        activeConnection: `${activeConnection.isPrimary ? 'PRIMARY' : 'FALLBACK'}: ${activeConnection.database}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', error: message };
    }
  }
}
