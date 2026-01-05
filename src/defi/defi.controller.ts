import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import {
  DefiService,
  DegenterOhlcvResponse,
  DegenterTokenDetailResponse,
  DegenterTokenHoldersResponse,
  DegenterTokenPoolsResponse,
  DegenterTokensResponse,
  DegenterTradesResponse,
  PoolTradesQuery,
  TokenHoldersQuery,
  TokensQuery,
} from './defi.service';

const parseOptionalNumber = (value?: string | string[]): number | undefined => {
  if (Array.isArray(value)) {
    value = value[0];
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

@ApiTags('DeFi')
@ApiBearerAuth('api-key')
@Controller('api/v2')
@UseInterceptors(CacheInterceptor)
export class DefiController {
  constructor(private readonly defiService: DefiService) {}

  @Get('tokens')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(120)
  async listTokens(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
  ): Promise<DegenterTokensResponse> {
    try {
      const parsedLimit = parseOptionalNumber(limit);
      const parsedOffset = parseOptionalNumber(offset);

      const query: TokensQuery = {};
      if (parsedLimit !== undefined) {
        query.limit = parsedLimit;
      }
      if (parsedOffset !== undefined) {
        query.offset = parsedOffset;
      }
      if (typeof sort === 'string' && sort.trim().length > 0) {
        query.sort = sort.trim();
      }
      if (typeof dir === 'string' && dir.trim().length > 0) {
        query.dir = dir.trim();
      }

      return await this.defiService.getTokens(query);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch tokens from Degenter API';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('tokens/details/:denom')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(120)
  async getTokenDetail(@Param('denom') denom: string): Promise<DegenterTokenDetailResponse> {
    try {
      return await this.defiService.getTokenByDenom(denom);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch token detail from Degenter API';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('tokens/:denom/pools')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getTokenPools(@Param('denom') denom: string): Promise<DegenterTokenPoolsResponse> {
    try {
      return await this.defiService.getTokenPools(denom);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch token pools from Degenter API';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('tokens/:denom/holders')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getTokenHolders(
    @Param('denom') denom: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<DegenterTokenHoldersResponse> {
    try {
      const parsedLimit = parseOptionalNumber(limit);
      const parsedOffset = parseOptionalNumber(offset);

      const query: TokenHoldersQuery = {};
      if (parsedLimit !== undefined) {
        query.limit = parsedLimit;
      }
      if (parsedOffset !== undefined) {
        query.offset = parsedOffset;
      }

      return await this.defiService.getTokenHolders(denom, query);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch token holders from Degenter API';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('tokens/:denom/ohlcv')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getTokenOhlcv(@Param('denom') denom: string): Promise<DegenterOhlcvResponse> {
    try {
      return await this.defiService.getTokenOhlcv(denom);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch token OHLCV from Degenter API';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }

  @Get('pools/:poolId/trades')
  @UseGuards(ApiKeyGuard)
  @CacheTTL(60)
  async getPoolTrades(
    @Param('poolId') poolId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unit') unit?: string,
    @Query('tf') tf?: string,
  ): Promise<DegenterTradesResponse> {
    try {
      const parsedLimit = parseOptionalNumber(limit);
      const parsedOffset = parseOptionalNumber(offset);

      const query: PoolTradesQuery = {};
      if (parsedLimit !== undefined) {
        query.limit = parsedLimit;
      }
      if (parsedOffset !== undefined) {
        query.offset = parsedOffset;
      }
      if (typeof unit === 'string' && unit.trim().length > 0) {
        query.unit = unit.trim();
      }
      if (typeof tf === 'string' && tf.trim().length > 0) {
        query.tf = tf.trim();
      }

      return await this.defiService.getPoolTrades(poolId, query);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch trades from Degenter API';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }
  }
}
