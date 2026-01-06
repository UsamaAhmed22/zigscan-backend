import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { NetworkOverview, NetworkService } from './network.service';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Network')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('network/overview')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(120)
  async getNetworkOverview(): Promise<NetworkOverview> {
    try {
      return await this.networkService.getOverview();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch network overview metrics';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
