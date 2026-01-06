import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestCounter: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly apiKeyRequestCounter: Counter<string>;
  private readonly clickhouseFailureCounter: Counter<string>;
  private readonly sshTunnelStatus: Gauge<string>;

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'zigscan_',
    });

    this.httpRequestCounter = new Counter({
      name: 'zigscan_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'zigscan_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.apiKeyRequestCounter = new Counter({
      name: 'zigscan_api_key_requests_total',
      help: 'Total requests per API key prefix',
      labelNames: ['api_key_prefix'],
      registers: [this.registry],
    });

    this.clickhouseFailureCounter = new Counter({
      name: 'zigscan_clickhouse_failures_total',
      help: 'Number of ClickHouse query failures',
      labelNames: ['connection_type'],
      registers: [this.registry],
    });

    this.sshTunnelStatus = new Gauge({
      name: 'zigscan_ssh_tunnel_status',
      help: 'SSH tunnel status (1=up, 0=down)',
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpRequest(method: string, path: string, status: number, durationMs: number): void {
    const labels = {
      method,
      path,
      status: status.toString(),
    };
    this.httpRequestCounter.inc(labels);
    this.httpRequestDuration.observe(labels, durationMs / 1000);
  }

  recordApiKeyRequest(prefix: string): void {
    if (!prefix) {
      return;
    }
    this.apiKeyRequestCounter.inc({ api_key_prefix: prefix });
  }

  incrementClickhouseFailure(connectionType: 'primary' | 'fallback'): void {
    this.clickhouseFailureCounter.inc({ connection_type: connectionType });
  }

  updateSshTunnelStatus(active: boolean): void {
    this.sshTunnelStatus.set(active ? 1 : 0);
  }
}
