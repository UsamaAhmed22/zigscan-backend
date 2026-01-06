import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @UseGuards(ApiKeyGuard, AdminGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
