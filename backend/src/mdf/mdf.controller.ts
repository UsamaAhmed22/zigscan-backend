import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { MemesDotFunCoinsResponse } from '../dto/schema.dto';
import { MdfService } from './mdf.service';

@ApiTags('MDF')
@ApiBearerAuth('api-key')
@Controller('api/v2/mdf')
@UseGuards(ApiKeyGuard)
@UseInterceptors(CacheInterceptor)
export class MdfController {
  constructor(private readonly mdfService: MdfService) {}

  @Get('coins')
  @CacheTTL(60)
  @ApiOperation({ summary: 'Fetch the current Memes.fun coin list' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default: 10, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'Memes.fun coin data' })
  async getCoins(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ): Promise<MemesDotFunCoinsResponse> {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    return this.mdfService.getCoins(parsedPage, parsedLimit);
  }
}
