import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import { AppConfiguration } from '../config/configuration';

export interface DegenterToken {
  tokenId: string;
  denom: string;
  symbol: string;
  name: string;
  imageUri: string;
  createdAt: string;
  priceNative: number | null;
  priceUsd: number | null;
  mcapNative: number | null;
  mcapUsd: number | null;
  fdvNative: number | null;
  fdvUsd: number | null;
  holders: number | null;
  volNative: number | null;
  volUsd: number | null;
  tx: number | null;
}

export interface DegenterTokensMeta {
  bucket?: string;
  priceSource?: string;
  sort?: string;
  dir?: string;
  limit?: number;
  offset?: number;
  total?: number | string;
  [key: string]: unknown;
}

export interface DegenterTokensResponse {
  success: boolean;
  data: DegenterToken[];
  meta?: DegenterTokensMeta;
}

export interface DegenterTokenDetail extends DegenterToken {
  exponent?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  socials?: Record<string, unknown>;
  price?: Record<string, unknown>;
  mcap?: Record<string, unknown>;
  priceInNative?: number | null;
  priceInUsd?: number | null;
  priceSource?: string;
  poolId?: string | number;
  pools?: number | null;
  holder?: number | string | null;
  creationTime?: string;
  circulatingSupply?: number | null;
  fdv?: number | null;
  mc?: number | null;
  priceChange?: Record<string, unknown>;
  volume?: Record<string, unknown>;
  volumeUSD?: Record<string, unknown>;
  txBuckets?: Record<string, unknown>;
  uniqueTraders?: number | null;
  trade?: number | null;
  sell?: number | null;
  buy?: number | null;
  v?: number | null;
  vBuy?: number | null;
  vSell?: number | null;
  vUSD?: number | null;
  vBuyUSD?: number | null;
  vSellUSD?: number | null;
  liquidity?: number | null;
  liquidityNative?: number | null;
  [key: string]: unknown;
}

export interface DegenterTokenDetailResponse {
  success: boolean;
  data: DegenterTokenDetail;
}

export interface DegenterTokenPool {
  pairContract: string;
  base: {
    tokenId: string;
    symbol: string;
    denom: string;
    exponent?: number;
    [key: string]: unknown;
  };
  quote: {
    tokenId: string;
    symbol: string;
    denom: string;
    exponent?: number;
    [key: string]: unknown;
  };
  isUzigQuote: boolean;
  createdAt: string;
  priceNative?: number | null;
  priceUsd?: number | null;
  tvlNative?: number | null;
  tvlUsd?: number | null;
  volumeNative?: number | null;
  volumeUsd?: number | null;
  tx?: number | null;
  uniqueTraders?: number | null;
  [key: string]: unknown;
}

export interface DegenterTokenPoolsMeta {
  [key: string]: unknown;
}

export interface DegenterTokenPoolsResponse {
  success: boolean;
  token: {
    tokenId: string;
    symbol: string;
    denom: string;
    imageUri?: string;
    [key: string]: unknown;
  };
  data: DegenterTokenPool[];
  meta?: DegenterTokenPoolsMeta;
}

export interface DegenterTokenHolder {
  address: string;
  balance: number;
  pctOfMax?: number | null;
  pctOfTotal?: number | null;
  [key: string]: unknown;
}

export interface DegenterTokenHoldersMeta {
  limit?: number;
  offset?: number;
  totalHolders?: number;
  [key: string]: unknown;
}

export interface DegenterTokenHoldersResponse {
  success: boolean;
  data: DegenterTokenHolder[];
  meta?: DegenterTokenHoldersMeta;
}

export interface TokenHoldersQuery {
  limit?: number;
  offset?: number;
  [key: string]: number | string | undefined;
}

export interface TokensQuery {
  limit?: number;
  offset?: number;
  sort?: string;
  dir?: string;
}

export interface DegenterTrade {
  time: string;
  txHash: string;
  pairContract: string;
  signer: string;
  direction: 'buy' | 'sell' | string;
  offerDenom: string;
  offerAmountBase?: string | null;
  offerAmount?: number | null;
  askDenom: string;
  askAmountBase?: string | null;
  askAmount?: number | null;
  returnAmountBase?: string | null;
  returnAmount?: number | null;
  priceNative?: number | null;
  priceUsd?: number | null;
  valueNative?: number | null;
  valueUsd?: number | null;
  class?: string | null;
  [key: string]: unknown;
}

export interface DegenterTradesMeta {
  unit?: string;
  tf?: string;
  limit?: number;
  offset?: number;
  total?: number;
  [key: string]: unknown;
}

export interface DegenterTradesResponse {
  success: boolean;
  data: DegenterTrade[];
  meta?: DegenterTradesMeta;
}

export interface DegenterOhlcvCandle {
  ts_sec: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  trades?: number | null;
  [key: string]: unknown;
}

export interface DegenterOhlcvMeta {
  tf?: string;
  mode?: string;
  unit?: string;
  fill?: string;
  priceSource?: string;
  poolId?: string | number;
  [key: string]: unknown;
}

export interface DegenterOhlcvResponse {
  success: boolean;
  data: DegenterOhlcvCandle[];
  meta?: DegenterOhlcvMeta;
}

export interface PoolTradesQuery {
  limit?: number;
  offset?: number;
  unit?: string;
  tf?: string;
}

@Injectable()
export class DefiService {
  private readonly logger = new Logger(DefiService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const { apiBaseUrl } = this.configService.getOrThrow<AppConfiguration['defi']>('defi');

    this.client = axios.create({
      baseURL: apiBaseUrl.replace(/\/+$/, ''),
      timeout: 20_000,
      validateStatus: () => true,
    });
  }

  async getTokens(query: TokensQuery = {}): Promise<DegenterTokensResponse> {
    try {
      const params: Record<string, number | string> = {};

      if (query.limit !== undefined) {
        params.limit = query.limit;
      }
      if (query.offset !== undefined) {
        params.offset = query.offset;
      }
      if (query.sort) {
        params.sort = query.sort;
      }
      if (query.dir) {
        params.dir = query.dir;
      }

      const response = await this.client.get<DegenterTokensResponse>('/tokens', {
        params: Object.keys(params).length > 0 ? params : undefined,
      });

      if (response.status >= 400) {
        throw new Error(`Degenter API responded with status ${response.status}`);
      }

      if (!response.data?.success) {
        throw new Error('Degenter API returned an unsuccessful response');
      }

      if (!Array.isArray(response.data.data)) {
        throw new Error('Degenter API returned an unexpected payload');
      }

      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message ?? 'Axios request failed';
        this.logger.error(`Failed to fetch tokens from Degenter API: ${message}`, error.stack);
        throw new Error(
          status
            ? `Failed to fetch tokens from Degenter API (status ${status})`
            : 'Failed to fetch tokens from Degenter API',
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to fetch tokens';
      this.logger.error(`Failed to fetch tokens from Degenter API: ${message}`);
      throw new Error(message);
    }
  }

  async getTokenByDenom(denom: string): Promise<DegenterTokenDetailResponse> {
    try {
      const encodedDenom = encodeURIComponent(denom);
      const response = await this.client.get<DegenterTokenDetailResponse>(
        `/tokens/${encodedDenom}`,
      );

      if (response.status >= 400) {
        throw new Error(`Degenter API responded with status ${response.status}`);
      }

      if (!response.data?.success) {
        throw new Error('Degenter API returned an unsuccessful response');
      }

      if (!response.data.data) {
        throw new Error('Degenter API returned an unexpected payload');
      }

      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message ?? 'Axios request failed';
        this.logger.error(
          `Failed to fetch token detail from Degenter API: ${message}`,
          error.stack,
        );
        throw new Error(
          status
            ? `Failed to fetch token detail from Degenter API (status ${status})`
            : 'Failed to fetch token detail from Degenter API',
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to fetch token detail';
      this.logger.error(`Failed to fetch token detail from Degenter API: ${message}`);
      throw new Error(message);
    }
  }

  async getTokenPools(denom: string): Promise<DegenterTokenPoolsResponse> {
    try {
      const encodedDenom = encodeURIComponent(denom);
      const response = await this.client.get<DegenterTokenPoolsResponse>(
        `/tokens/${encodedDenom}/pools`,
      );

      if (response.status >= 400) {
        throw new Error(`Degenter API responded with status ${response.status}`);
      }

      if (!response.data?.success) {
        throw new Error('Degenter API returned an unsuccessful response');
      }

      if (!Array.isArray(response.data.data)) {
        throw new Error('Degenter API returned an unexpected payload');
      }

      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message ?? 'Axios request failed';
        this.logger.error(`Failed to fetch token pools from Degenter API: ${message}`, error.stack);
        throw new Error(
          status
            ? `Failed to fetch token pools from Degenter API (status ${status})`
            : 'Failed to fetch token pools from Degenter API',
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to fetch token pools';
      this.logger.error(`Failed to fetch token pools from Degenter API: ${message}`);
      throw new Error(message);
    }
  }

  async getTokenHolders(
    denom: string,
    query: TokenHoldersQuery = {},
  ): Promise<DegenterTokenHoldersResponse> {
    try {
      const encodedDenom = encodeURIComponent(denom);
      const response = await this.client.get<DegenterTokenHoldersResponse>(
        `/tokens/${encodedDenom}/holders`,
        { params: query },
      );

      if (response.status >= 400) {
        throw new Error(`Degenter API responded with status ${response.status}`);
      }

      if (!response.data?.success) {
        throw new Error('Degenter API returned an unsuccessful response');
      }

      if (!Array.isArray(response.data.data)) {
        throw new Error('Degenter API returned an unexpected payload');
      }

      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message ?? 'Axios request failed';
        this.logger.error(
          `Failed to fetch token holders from Degenter API: ${message}`,
          error.stack,
        );
        throw new Error(
          status
            ? `Failed to fetch token holders from Degenter API (status ${status})`
            : 'Failed to fetch token holders from Degenter API',
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to fetch token holders';
      this.logger.error(`Failed to fetch token holders from Degenter API: ${message}`);
      throw new Error(message);
    }
  }

  async getPoolTrades(
    poolId: string | number,
    query: PoolTradesQuery = {},
  ): Promise<DegenterTradesResponse> {
    try {
      const limit = Math.max(query.limit ?? 50, 1);
      const offset = Math.max(query.offset ?? 0, 0);
      const page = Math.floor(offset / limit) + 1;
      const intraPageOffset = offset % limit;

      const params: Record<string, number | string> = {
        pool_id: typeof poolId === 'number' ? poolId : String(poolId),
        limit,
        page,
        unit: query.unit ?? 'usd',
        tf: query.tf ?? '24h',
      };

      const response = await this.client.get<DegenterTradesResponse>('/trades', { params });

      if (response.status >= 400) {
        throw new Error(`Degenter API responded with status ${response.status}`);
      }

      if (!response.data?.success) {
        throw new Error('Degenter API returned an unsuccessful response');
      }

      if (!Array.isArray(response.data.data)) {
        throw new Error('Degenter API returned an unexpected payload');
      }

      const adjustedData = response.data.data.slice(intraPageOffset, intraPageOffset + limit);

      const adjustedMeta = {
        ...(response.data.meta ?? {}),
        limit,
        offset,
        page,
      };

      return {
        ...response.data,
        data: adjustedData,
        meta: adjustedMeta,
      };
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message ?? 'Axios request failed';
        this.logger.error(`Failed to fetch trades from Degenter API: ${message}`, error.stack);
        throw new Error(
          status
            ? `Failed to fetch trades from Degenter API (status ${status})`
            : 'Failed to fetch trades from Degenter API',
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to fetch trades';
      this.logger.error(`Failed to fetch trades from Degenter API: ${message}`);
      throw new Error(message);
    }
  }

  async getTokenOhlcv(denom: string): Promise<DegenterOhlcvResponse> {
    try {
      const encodedDenom = encodeURIComponent(denom);
      const params: Record<string, string> = {
        unit: 'usd',
        mode: 'price',
        fill: 'prev',
        tf: '15m',
        from: '2025-10-19T00:00:00.000Z',
        to: '2025-10-20T00:00:00.000Z',
      };

      const response = await this.client.get<DegenterOhlcvResponse>(
        `/tokens/${encodedDenom}/ohlcv`,
        { params },
      );

      if (response.status >= 400) {
        throw new Error(`Degenter API responded with status ${response.status}`);
      }

      if (!response.data?.success) {
        throw new Error('Degenter API returned an unsuccessful response');
      }

      if (!Array.isArray(response.data.data)) {
        throw new Error('Degenter API returned an unexpected payload');
      }

      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.message ?? 'Axios request failed';
        this.logger.error(`Failed to fetch token OHLCV from Degenter API: ${message}`, error.stack);
        throw new Error(
          status
            ? `Failed to fetch token OHLCV from Degenter API (status ${status})`
            : 'Failed to fetch token OHLCV from Degenter API',
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to fetch token OHLCV';
      this.logger.error(`Failed to fetch token OHLCV from Degenter API: ${message}`);
      throw new Error(message);
    }
  }
}
