import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TvlSnapshot as TvlSnapshotEntity } from '../database/entities/tvl-snapshot.entity';

export interface TvlSnapshot {
  total_tvl: number;
  valdora_staking: number;
  oroswap: number;
  permapod_red_bank: number;
  nawa_vaults: number;
  timestamp: string;
}

/**
 * TVL Service - Read-Only
 *
 * This service only READS TVL data from the database.
 * Data is populated externally by a separate process.
 * No data capture, insertion, or migration is performed by this service.
 */
@Injectable()
export class TvlService {
  private readonly logger = new Logger(TvlService.name);

  constructor(
    @InjectRepository(TvlSnapshotEntity)
    private readonly tvlRepository: Repository<TvlSnapshotEntity>,
  ) {
    this.logger.log('TVL Service initialized (read-only mode)');
  }

  /**
   * Get the latest TVL snapshot from database
   */
  async getLatestSnapshot(): Promise<TvlSnapshot | null> {
    try {
      const latestRow = await this.tvlRepository
        .createQueryBuilder('tvl')
        .select('MAX(tvl.created_at)', 'latestAt')
        .getRawOne<{ latestAt: Date | null }>();

      const latestAt = latestRow?.latestAt;
      if (!latestAt) {
        this.logger.warn('No TVL data found in database');
        return null;
      }

      const entities = await this.tvlRepository
        .createQueryBuilder('tvl')
        .select('tvl.entity_name', 'entityName')
        .addSelect('SUM(tvl.tvl_value)', 'tvlValue')
        .where('tvl.created_at = :latestAt', { latestAt })
        .groupBy('tvl.entity_name')
        .getRawMany<{ entityName: string; tvlValue: string }>();

      const normalizedEntities = entities.map(entry => ({
        entityName: entry.entityName,
        tvlValue: Number(entry.tvlValue ?? 0),
      }));

      return this.buildSnapshotFromEntries(normalizedEntities, latestAt);
    } catch (error) {
      this.logger.error('Failed to fetch latest TVL snapshot', error);
      throw error;
    }
  }

  /**
   * Get historical TVL data (last 30 days)
   */
  async getHistory(): Promise<TvlSnapshot[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const allData = await this.tvlRepository
        .createQueryBuilder('tvl')
        .where('tvl.created_at >= :date', { date: thirtyDaysAgo })
        .orderBy('tvl.created_at', 'DESC')
        .getMany();

      const grouped = new Map<string, Map<string, number>>();

      for (const item of allData) {
        const timestamp = item.createdAt.toISOString();
        const entityMap = grouped.get(timestamp) ?? new Map<string, number>();
        const currentValue = entityMap.get(item.entityName) ?? 0;
        entityMap.set(item.entityName, currentValue + item.tvlValue);
        grouped.set(timestamp, entityMap);
      }

      return Array.from(grouped.entries()).map(([timestamp, entityMap]) => {
        const entries = Array.from(entityMap.entries()).map(([entityName, tvlValue]) => ({
          entityName,
          tvlValue,
        }));
        return this.buildSnapshotFromEntries(entries, timestamp);
      });
    } catch (error) {
      this.logger.error('Failed to fetch TVL history', error);
      throw error;
    }
  }

  private buildSnapshotFromEntries(
    entities: Array<{ entityName: string; tvlValue: number }>,
    timestampValue: Date | string,
  ): TvlSnapshot {
    const valdora = this.findEntityValue(entities, ['valdoraStaking', 'valdora_staking']) ?? 0;
    const oroswap = this.findEntityValue(entities, ['oroswap']) ?? 0;
    const permapodRedBank =
      this.findEntityValue(entities, ['permapodRedBank', 'permapod_red_bank']) ?? 0;
    const nawaVaults = this.findEntityValue(entities, ['nawaVaults', 'nawa_vaults']) ?? 0;

    const totalEntityValue = this.findEntityValue(entities, ['totalTvl', 'total_tvl']);
    const computedTotal = valdora + oroswap + permapodRedBank + nawaVaults;
    const total = totalEntityValue ?? computedTotal;

    const timestamp =
      typeof timestampValue === 'string' ? timestampValue : timestampValue.toISOString();

    return {
      total_tvl: this.toCurrency(total),
      valdora_staking: this.toCurrency(valdora),
      oroswap: this.toCurrency(oroswap),
      permapod_red_bank: this.toCurrency(permapodRedBank),
      nawa_vaults: this.toCurrency(nawaVaults),
      timestamp,
    };
  }

  private findEntityValue(
    entities: Array<{ entityName: string; tvlValue: number }>,
    keys: string[],
  ): number | undefined {
    for (const key of keys) {
      const match = entities.find(e => e.entityName === key);
      if (match && Number.isFinite(match.tvlValue)) {
        return match.tvlValue;
      }
    }
    return undefined;
  }

  /**
   * Format number to 2 decimal places
   */
  private toCurrency(value: number): number {
    return Number(value.toFixed(2));
  }
}
