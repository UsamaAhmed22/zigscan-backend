import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { BlockMintingSnapshot, BlockStats, BlockTransaction } from '../dto/schema.dto';
import { BlocksService } from './blocks.service';
import { BlocksQueryDto } from './dto/blocks-query.dto';
import { BlocksStatsQueryDto } from './dto/blocks-stats-query.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Blocks')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get('blocks')
  @UseGuards(ApiKeyGuard)
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @CacheTTL(60)
  async getBlocks(
    @Query() query: BlocksQueryDto,
  ): Promise<{ data: BlockMintingSnapshot[]; total_count: number }> {
    return this.blocksService.getBlocks(query);
  }

  @Get('blocks/stats')
  @UseGuards(ApiKeyGuard)
  @ApiQuery({ name: 'days', required: false, type: Number, example: 30 })
  @CacheTTL(300)
  async getBlockStats(@Query() query: BlocksStatsQueryDto): Promise<BlockStats> {
    return this.blocksService.getBlockStats(query);
  }

  @Get('blocks/details/:height')
  @UseGuards(ApiKeyGuard)
  @ApiParam({ name: 'height', type: Number, example: 2885826 })
  @CacheTTL(300)
  async getBlockDetail(
    @Param('height', ParseIntPipe) height: number,
  ): Promise<Record<string, unknown>> {
    try {
      return await this.blocksService.getBlockDetail(height);
    } catch (error) {
      const errorWithStatus = error as { status?: number };
      const status =
        typeof errorWithStatus?.status === 'number'
          ? errorWithStatus.status
          : error instanceof Error && /not found/i.test(error.message)
            ? HttpStatus.NOT_FOUND
            : HttpStatus.BAD_GATEWAY;
      const message = error instanceof Error ? error.message : 'Failed to fetch block details';
      throw new HttpException(message, status);
    }
  }

  @Get('blocks/transactions/:height')
  @UseGuards(ApiKeyGuard)
  @ApiParam({ name: 'height', type: Number, example: 2885826 })
  @CacheTTL(300)
  async getBlockTransactions(
    @Param('height', ParseIntPipe) height: number,
  ): Promise<BlockTransaction[]> {
    return this.blocksService.getBlockTransactions(height);
  }
}
