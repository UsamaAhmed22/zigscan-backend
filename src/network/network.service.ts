import { Injectable } from '@nestjs/common';
import { BlocksService } from '../blocks/blocks.service';
import { ValidatorsService } from '../validators/validators.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ZigSupplyService, ZigStakingPool } from '../supply/supply.service';
import { BlockMintingSnapshot, TransactionStats } from '../dto/schema.dto';

type ValidatorStatusKey = 'bonded' | 'unbonding' | 'unbonded';

interface ValidatorStatusCounts {
  bonded: number;
  unbonding: number;
  unbonded: number;
  total: number;
}

interface TransactionsOverview {
  total: number;
  last30d: number;
  last15d: number;
  last7d: number;
  tpsAllTime: number;
  trueTpsAllTime: number;
  hourly: Record<string, number>;
}

interface BlockOverview {
  perDay: Record<string, number>;
  avgBlockTimeSeconds: number | null;
  minBlockTimeSeconds: number | null;
  avgTxsPerBlock: number | null;
}

export interface NetworkOverview {
  currentBlock: BlockMintingSnapshot | null;
  validators: ValidatorStatusCounts;
  stakingPool: ZigStakingPool;
  transactions: TransactionsOverview;
  blocks: BlockOverview;
}

@Injectable()
export class NetworkService {
  constructor(
    private readonly blocksService: BlocksService,
    private readonly validatorsService: ValidatorsService,
    private readonly transactionsService: TransactionsService,
    private readonly zigSupplyService: ZigSupplyService,
  ) {}

  async getOverview(): Promise<NetworkOverview> {
    const [latestBlocks, blockStats, txStatsRaw, stakingPool, validatorCounts] = await Promise.all([
      this.blocksService.getBlocks({ limit: 1, offset: 0 }),
      this.blocksService.getBlockStats({ days: 30 }),
      this.transactionsService.getTransactionStats(),
      this.zigSupplyService.getStakingPool(),
      this.fetchValidatorCounts(),
    ]);

    const currentBlock = latestBlocks.data?.[0] ?? null;
    const txStats = (txStatsRaw ?? {}) as Partial<TransactionStats>;

    const transactions: TransactionsOverview = {
      total: Number(txStats.tx_total ?? 0),
      last30d: Number(txStats.tx_last_30d ?? 0),
      last15d: Number(txStats.tx_last_15d ?? 0),
      last7d: Number(txStats.tx_last_7d ?? 0),
      tpsAllTime: Number(txStats.tps_all_time ?? 0),
      trueTpsAllTime: Number(txStats.true_tps_all_time ?? 0),
      hourly:
        txStats.hourly_txns && typeof txStats.hourly_txns === 'object' ? txStats.hourly_txns : {},
    };

    const blocks: BlockOverview = {
      perDay: blockStats.blocks_per_day ?? {},
      avgBlockTimeSeconds: blockStats.avg_block_time_seconds ?? null,
      minBlockTimeSeconds: blockStats.min_block_time_seconds ?? null,
      avgTxsPerBlock: blockStats.avg_txs_per_block ?? null,
    };

    return {
      currentBlock,
      validators: validatorCounts,
      stakingPool,
      transactions,
      blocks,
    };
  }

  private async fetchValidatorCounts(): Promise<ValidatorStatusCounts> {
    const statuses: Array<{ key: ValidatorStatusKey; status: string }> = [
      { key: 'bonded', status: 'BOND_STATUS_BONDED' },
      { key: 'unbonding', status: 'BOND_STATUS_UNBONDING' },
      { key: 'unbonded', status: 'BOND_STATUS_UNBONDED' },
    ];

    const baseCounts: Record<ValidatorStatusKey, number> = {
      bonded: 0,
      unbonding: 0,
      unbonded: 0,
    };

    await Promise.all(
      statuses.map(async ({ key, status }) => {
        const count = await this.validatorsService.getValidatorsCount(status);
        baseCounts[key] = count;
      }),
    );

    const total = baseCounts.bonded + baseCounts.unbonding + baseCounts.unbonded;

    return {
      ...baseCounts,
      total,
    };
  }
}
