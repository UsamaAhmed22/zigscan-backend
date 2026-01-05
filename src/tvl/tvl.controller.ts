import { Controller, Get, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { TvlService, TvlSnapshot } from './tvl.service';

@ApiTags('TVL')
@ApiBearerAuth('api-key')
@Controller('api/v2')
export class TvlController {
  constructor(private readonly tvlService: TvlService) {}

  @Get('tvl')
  @UseGuards(ApiKeyGuard)
  async getTvlOverview(): Promise<{ latest: TvlSnapshot | null; history: TvlSnapshot[] }> {
    try {
      const [latest, history] = await Promise.all([
        this.tvlService.getLatestSnapshot(),
        this.tvlService.getHistory(),
      ]);

      return { latest, history };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch TVL data';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
