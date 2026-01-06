import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import {
  ChartData,
  ZigStakingPool,
  ZigSupplyMetrics,
  ZigSupplyService,
  ZigSupplySummary,
} from './supply.service';

@ApiTags('Supply')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class SupplyController {
  constructor(private readonly supplyService: ZigSupplyService) {}

  @Get('supply')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getSupply(): Promise<ZigSupplyMetrics> {
    try {
      return await this.supplyService.getSupplyMetrics();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch supply data';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('zig/market-data')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getZigPriceData(): Promise<ZigSupplySummary['priceData']> {
    try {
      return await this.supplyService.getZigPriceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Zig price data';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('zig/staking-pool')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getZigStakingPool(): Promise<ZigStakingPool> {
    try {
      return await this.supplyService.getStakingPool();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch staking pool data';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('zig/price-data')
  @UseGuards(ApiKeyGuard)
  @ApiQuery({ name: 'days', required: false, type: String, example: '24hr' })
  async getZigMarketData(@Query('days') days = '24hr'): Promise<ChartData> {
    try {
      return await this.supplyService.getZigHistoricalChart(days);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch Zig market chart data';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
