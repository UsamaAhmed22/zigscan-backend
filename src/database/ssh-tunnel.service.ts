import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTunnel, ForwardOptions } from 'tunnel-ssh';
import { readFileSync } from 'fs';
import type { Server } from 'net';
import { MetricsService } from '../metrics/metrics.service';

/**
 * SSH Tunnel Service
 *
 * Establishes an SSH tunnel to access a remote PostgreSQL database
 * that is only accessible via SSH (not exposed on public network).
 *
 * How it works:
 * 1. Creates SSH connection to remote server
 * 2. Forwards local port (e.g., 5433) to remote PostgreSQL port (5432)
 * 3. Your app connects to localhost:5433, which tunnels to remote:5432
 *
 * Configuration in .env:
 * - SSH_TUNNEL_ENABLED=true
 * - SSH_HOST=your-server-ip
 * - SSH_USERNAME=ubuntu
 * - SSH_PASSWORD or SSH_PRIVATE_KEY (use one)
 * - SSH_LOCAL_PORT=5433 (local port to forward)
 * - SSH_REMOTE_PORT=5432 (remote PostgreSQL port)
 */
@Injectable()
export class SshTunnelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SshTunnelService.name);
  private tunnels: Array<{ name: string; server: Server; client: any }> = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const sshEnabled = this.configService.get<string>('SSH_TUNNEL_ENABLED', 'false') === 'true';

    if (!sshEnabled) {
      this.logger.log('SSH tunnel is disabled');
      this.metricsService.updateSshTunnelStatus(false);
      return;
    }

    try {
      await this.createTunnels();
      this.logger.log('✓ SSH tunnel established successfully');
      this.metricsService.updateSshTunnelStatus(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create SSH tunnel: ${message}`);
      this.metricsService.updateSshTunnelStatus(false);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.closeAllTunnels();
  }

  private closeAllTunnels(): void {
    if (this.tunnels.length === 0) {
      return;
    }

    for (const { name, server, client } of this.tunnels) {
      server.close();
      client.end();
      this.logger.log(`SSH tunnel (${name}) closed`);
    }

    this.tunnels = [];
    this.metricsService.updateSshTunnelStatus(false);
  }

  private getForwardConfigurations(): Array<ForwardOptions & { name: string }> {
    const clickhouseSrcHost = this.configService.get<string>('SSH_LOCAL_HOST', '127.0.0.1');
    const clickhouseSrcPort = this.configService.get<number>('SSH_LOCAL_PORT', 8123);
    const clickhouseDstPort = this.configService.get<number>('SSH_REMOTE_PORT', 8123);

    const postgresSrcHost = this.configService.get<string>('ZIGSCAN_POSTGRES_HOST', '127.0.0.1');
    const postgresSrcPort = this.configService.get<number>('ZIGSCAN_POSTGRES_PORT', 5433);
    const postgresDstHost = this.configService.get<string>(
      'ZIGSCAN_POSTGRES_REMOTE_HOST',
      '127.0.0.1',
    );
    const postgresDstPort = this.configService.get<number>('ZIGSCAN_POSTGRES_REMOTE_PORT', 5432);

    return [
      {
        name: 'ClickHouse',
        srcAddr: clickhouseSrcHost,
        srcPort: clickhouseSrcPort,
        dstAddr: '127.0.0.1',
        dstPort: clickhouseDstPort,
      },
      {
        name: 'ZigScan Postgres',
        srcAddr: postgresSrcHost,
        srcPort: postgresSrcPort,
        dstAddr: postgresDstHost,
        dstPort: postgresDstPort,
      },
    ];
  }

  private async createTunnels(): Promise<void> {
    const sshOptionsBase = {
      host: this.configService.get<string>('SSH_HOST', ''),
      port: this.configService.get<number>('SSH_PORT', 22),
      username: this.configService.get<string>('SSH_USERNAME', ''),
    };

    const forwardConfigs = this.getForwardConfigurations();

    try {
      for (const forwardConfig of forwardConfigs) {
        await this.createTunnel(sshOptionsBase, forwardConfig);
      }
    } catch (error) {
      this.closeAllTunnels();
      throw error;
    }
  }

  private async createTunnel(
    sshOptionsBase: { host: string; port: number; username: string },
    forwardOptions: ForwardOptions & { name: string },
  ): Promise<void> {
    // Try SSH_PRIVATE_KEY_PATH first (for local dev), then SSH_PRIVATE_KEY (for Docker)
    const privateKeyPath =
      this.configService.get<string>('SSH_PRIVATE_KEY_PATH') ||
      this.configService.get<string>('SSH_PRIVATE_KEY');
    const password = this.configService.get<string>('SSH_PASSWORD');

    let sshOptions: any = {
      ...sshOptionsBase,
    };

    // Use either password or private key
    if (privateKeyPath) {
      try {
        const privateKey = readFileSync(privateKeyPath, 'utf8');
        sshOptions.privateKey = privateKey;
        const passphrase = this.configService.get<string>('SSH_PASSPHRASE');
        if (passphrase) {
          sshOptions.passphrase = passphrase;
        }
        this.logger.log(`Using SSH private key from: ${privateKeyPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to read SSH private key from ${privateKeyPath}: ${message}. Check file exists and has correct permissions (chmod 600).`,
        );
      }
    } else if (password) {
      sshOptions.password = password;
      this.logger.log('Using SSH password authentication');
    } else {
      throw new Error('SSH_PRIVATE_KEY_PATH, SSH_PRIVATE_KEY, or SSH_PASSWORD must be configured');
    }

    const tunnelOptions = {
      autoClose: false,
      reconnectOnError: false,
    };

    // Allow a few retries when the local port is still cleaning up from a previous tunnel.
    const maxRetries = Math.max(0, this.configService.get<number>('SSH_TUNNEL_RETRY_ATTEMPTS', 3));
    const retryDelayMs = Math.max(
      0,
      this.configService.get<number>('SSH_TUNNEL_RETRY_DELAY_MS', 2000),
    );
    const totalAttempts = maxRetries + 1;

    this.logger.log(
      `Creating SSH tunnel (${forwardOptions.name}): ${forwardOptions.srcAddr}:${forwardOptions.srcPort} -> ${sshOptions.host}:${forwardOptions.dstPort}`,
    );

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        const serverOptions =
          forwardOptions.srcAddr || forwardOptions.srcPort
            ? {
                host: forwardOptions.srcAddr,
                port: forwardOptions.srcPort,
              }
            : undefined;

        const [server, client] = await createTunnel(
          tunnelOptions,
          serverOptions,
          sshOptions,
          forwardOptions,
        );

        this.tunnels.push({
          name: forwardOptions.name,
          server,
          client,
        });

        server.on('error', err => {
          this.logger.error(`SSH tunnel (${forwardOptions.name}) server error`, err);
          this.metricsService.updateSshTunnelStatus(false);
        });

        client.on('error', err => {
          this.logger.error(`SSH tunnel (${forwardOptions.name}) client error`, err);
          this.metricsService.updateSshTunnelStatus(false);
        });

        server.on('close', () => {
          this.logger.warn(`SSH tunnel (${forwardOptions.name}) server closed`);
          this.metricsService.updateSshTunnelStatus(false);
        });

        client.on('close', () => {
          this.logger.warn(`SSH tunnel (${forwardOptions.name}) client closed`);
          this.metricsService.updateSshTunnelStatus(false);
        });

        // Give the tunnel a moment to fully establish
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isAddrInUse = message.includes('EADDRINUSE');
        const canRetry = isAddrInUse && attempt < totalAttempts;

        if (canRetry) {
          const portDisplay = forwardOptions.srcPort ?? 'auto';
          this.logger.warn(
            `Port ${portDisplay} busy for ${forwardOptions.name}; retrying in ${retryDelayMs}ms (attempt ${attempt + 1}/${totalAttempts})`,
          );
          if (retryDelayMs > 0) {
            await this.delay(retryDelayMs);
          }
          continue;
        }

        throw new Error(`Failed to create SSH tunnel (${forwardOptions.name}): ${message}`);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async reconnect(): Promise<void> {
    this.closeAllTunnels();
    await this.createTunnels();
    this.metricsService.updateSshTunnelStatus(true);
  }
}
