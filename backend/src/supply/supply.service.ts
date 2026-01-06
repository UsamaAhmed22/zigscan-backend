import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { BlockchainService } from '../blockchain/blockchain.service';

interface SupplyByDenomResponse {
  amount?: {
    denom: string;
    amount: string;
  };
}

export type MarketChartPoint = [number, number];

export interface ChartData {
  prices: MarketChartPoint[];
  market_caps: MarketChartPoint[];
  total_volumes: MarketChartPoint[];
}

export interface ZigSupplyMetrics {
  denom: string;
  amountMicro: string;
  amount: string;
  circulatingSupply: number;
  nonCirculatingSupply: number | null;
}

export interface ZigSupplySummary {
  onChainSupply: {
    denom: string;
    amountMicro: string;
    amount: string;
  };
  priceData: {
    name: string;
    symbol: string;
    current_price: number;
    price_change_24h: number;
    price_change_7d: number | null;
    price_change_30d: number | null;
    price_change_90d: number | null;
    circulating_supply: number;
    nonCirculatingSupply: number | null;
    total_supply: number | null;
    max_supply: number | null;
    market_cap: number;
    total_volume: number;
    image: string;
  };
  derived: {
    circulatingSupply: number;
    nonCirculatingSupply: number | null;
    totalSupply: string;
  };
}

export interface ZigStakingPool {
  bondedTokensMicro: string;
  bondedTokens: string;
  notBondedTokensMicro: string;
  notBondedTokens: string;
}

const MICRO_UNIT = BigInt(1_000_000);

@Injectable()
export class ZigSupplyService {
  private readonly logger = new Logger(ZigSupplyService.name);
  private readonly coinGeckoClient: AxiosInstance;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {
    this.coinGeckoClient = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3',
      timeout: 15_000,
    });
  }

  async getZigSupplySummary(): Promise<ZigSupplySummary> {
    const [onChainSupply, priceData] = await Promise.all([
      this.fetchOnChainSupply(),
      this.fetchCoinGeckoData(),
    ]);

    const priceCirculatingSupply = priceData.circulating_supply;
    const totalSupplyNumeric = Number(onChainSupply.amount);
    const nonCirculatingSupply =
      Number.isFinite(totalSupplyNumeric) && Number.isFinite(priceCirculatingSupply)
        ? Number((totalSupplyNumeric - priceCirculatingSupply).toFixed(2))
        : null;

    return {
      onChainSupply,
      priceData,
      derived: {
        circulatingSupply: priceCirculatingSupply,
        nonCirculatingSupply,
        totalSupply: onChainSupply.amount,
      },
    };
  }

  async getOnChainSupply(): Promise<ZigSupplySummary['onChainSupply']> {
    return this.fetchOnChainSupply();
  }

  async getZigPriceData(): Promise<ZigSupplySummary['priceData']> {
    return this.fetchCoinGeckoData();
  }

  async getZigHistoricalChart(days: string): Promise<ChartData> {
    return this.fetchHistoricalChart(days);
  }

  async getSupplyMetrics(): Promise<ZigSupplyMetrics> {
    const [onChainSupply, priceData] = await Promise.all([
      this.fetchOnChainSupply(),
      this.fetchCoinGeckoData(),
    ]);

    const totalSupplyValue = Number(onChainSupply.amount);
    const circulatingSupply = priceData.circulating_supply;
    const nonCirculatingSupply =
      Number.isFinite(totalSupplyValue) && Number.isFinite(circulatingSupply)
        ? Number((totalSupplyValue - circulatingSupply).toFixed(6))
        : null;

    return {
      denom: onChainSupply.denom,
      amountMicro: onChainSupply.amountMicro,
      amount: onChainSupply.amount,
      circulatingSupply,
      nonCirculatingSupply,
    };
  }

  async getStakingPool(): Promise<ZigStakingPool> {
    const response = await this.blockchainService.getFromApi<{
      pool?: { bonded_tokens?: string; not_bonded_tokens?: string };
    }>('/cosmos/staking/v1beta1/pool');

    if (response.status !== 200 || !response.data?.pool) {
      throw new Error(
        `Failed to fetch staking pool: HTTP ${response.status} ${JSON.stringify(response.data)}`,
      );
    }

    const bondedTokensMicro = response.data.pool.bonded_tokens ?? '0';
    const notBondedTokensMicro = response.data.pool.not_bonded_tokens ?? '0';

    return {
      bondedTokensMicro,
      bondedTokens: this.convertMicroToBase(bondedTokensMicro),
      notBondedTokensMicro,
      notBondedTokens: this.convertMicroToBase(notBondedTokensMicro),
    };
  }

  private async fetchOnChainSupply(): Promise<ZigSupplySummary['onChainSupply']> {
    const response = await this.blockchainService.getFromApi<SupplyByDenomResponse>(
      '/cosmos/bank/v1beta1/supply/by_denom',
      { params: { denom: 'uzig' } },
    );

    if (response.status !== 200 || !response.data?.amount) {
      throw new Error(
        `Failed to fetch on-chain supply: HTTP ${response.status} ${JSON.stringify(response.data)}`,
      );
    }

    const denom = response.data.amount.denom;
    const amountMicro = response.data.amount.amount;
    const amount = this.convertMicroToBase(amountMicro);

    return { denom, amountMicro, amount };
  }

  private async fetchHistoricalChart(days: string): Promise<ChartData> {
    const { coingeckoId, apiKey } = this.getCoinGeckoCredentials();

    const response = await this.coinGeckoClient.get(`/coins/${coingeckoId}/market_chart`, {
      headers: {
        'x-cg-demo-api-key': apiKey,
      },
      params: {
        vs_currency: 'usd',
        days,
      },
    });

    if (!response.data) {
      throw new Error(`No historical data found for ${days} days`);
    }

    return response.data as ChartData;
  }

  private convertMicroToBase(amount: string): string {
    const parsed = amount.trim();
    if (!/^\d+$/.test(parsed)) {
      throw new Error(`Invalid micro-denom amount received: ${amount}`);
    }

    const microAmount = BigInt(parsed);
    const basePart = microAmount / MICRO_UNIT;
    const fractionPart = microAmount % MICRO_UNIT;

    if (fractionPart === BigInt(0)) {
      return basePart.toString();
    }

    const fractionString = fractionPart.toString().padStart(6, '0').replace(/0+$/, '');
    return `${basePart.toString()}.${fractionString}`;
  }

  private async fetchCoinGeckoData(): Promise<ZigSupplySummary['priceData']> {
    const { coingeckoId, apiKey } = this.getCoinGeckoCredentials();

    const response = await this.coinGeckoClient.get('/coins/markets', {
      headers: {
        'x-cg-demo-api-key': apiKey,
      },
      params: {
        vs_currency: 'usd',
        ids: coingeckoId,
        sparkline: false,
        price_change_percentage: '24h,7d,30d,90d',
      },
    });

    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('ZIG token data not found on CoinGecko');
    }

    const tokenData = response.data[0] as Record<string, any>;

    const circulatingSupply = this.toNumberOrThrow(
      tokenData.circulating_supply,
      'circulating_supply',
    );
    const maxSupply = this.toNullableNumber(tokenData.max_supply);
    const nonCirculatingSupply =
      typeof maxSupply === 'number' ? Number((maxSupply - circulatingSupply).toFixed(2)) : null;

    return {
      name: tokenData.name as string,
      symbol: tokenData.symbol as string,
      current_price: this.toNumberOrThrow(tokenData.current_price, 'current_price'),
      price_change_24h: this.toNumberOrDefault(tokenData.price_change_percentage_24h, 0),
      price_change_7d: this.toNullableNumber(tokenData.price_change_percentage_7d_in_currency),
      price_change_30d: this.toNullableNumber(tokenData.price_change_percentage_30d_in_currency),
      price_change_90d: this.toNullableNumber(tokenData.price_change_percentage_90d_in_currency),
      circulating_supply: circulatingSupply,
      nonCirculatingSupply,
      total_supply: this.toNullableNumber(tokenData.total_supply),
      max_supply: maxSupply,
      market_cap: this.toNumberOrThrow(tokenData.market_cap, 'market_cap'),
      total_volume: this.toNumberOrThrow(tokenData.total_volume, 'total_volume'),
      image: (tokenData.image as string) ?? '',
    };
  }

  private getCoinGeckoCredentials(): { coingeckoId: string; apiKey: string } {
    const coingeckoId = this.configService.get<string>('COINGECKO_ZIG_ID');
    const apiKey = this.configService.get<string>('COINGECKO_API_KEY');

    if (!coingeckoId || !apiKey) {
      throw new Error('COINGECKO_ZIG_ID or COINGECKO_API_KEY not found in environment variables');
    }

    return { coingeckoId, apiKey };
  }
  private toNumberOrThrow(value: unknown, field: string): number {
    const result = Number(value);
    if (!Number.isFinite(result)) {
      throw new Error(`Invalid numeric value for ${field}: ${value}`);
    }
    return result;
  }

  private toNumberOrDefault(value: unknown, defaultValue: number): number {
    const result = Number(value);
    return Number.isFinite(result) ? result : defaultValue;
  }

  private toNullableNumber(value: unknown): number | null {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
}
