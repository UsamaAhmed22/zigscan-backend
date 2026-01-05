import { Injectable, Logger } from '@nestjs/common';
import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ZigscanPostgresService } from '../zigscan-postgres/zigscan-postgres.service';
import { BlockMintingSnapshot, BlockStats, BlockTransaction } from '../dto/schema.dto';
import { BlocksQueryDto } from './dto/blocks-query.dto';
import { BlocksStatsQueryDto } from './dto/blocks-stats-query.dto';

@Injectable()
export class BlocksService {
  private readonly logger = new Logger(BlocksService.name);

  constructor(
    private readonly clickhouseService: ClickhouseService,
    private readonly blockchainService: BlockchainService,
    private readonly zigscanPostgresService: ZigscanPostgresService,
  ) {}

  async getBlocks(
    query: BlocksQueryDto,
  ): Promise<{ data: BlockMintingSnapshot[]; total_count: number }> {
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const sql = `
      SELECT
        b.height,
        b.proposer_address,
        b.block_time,
        b.num_txs,
        v.moniker,
        v.operator_address,
        v.consensus_pub_key,
        v.identity
      FROM blocks b
      LEFT JOIN validators v
        ON b.proposer_address = tendermint_address_from_pubkey(v.consensus_pub_key)
      ORDER BY b.height DESC
      LIMIT $1
      OFFSET $2
    `;

    this.logger.debug('Fetching latest blocks from ZigScan Postgres', { limit, offset });

    type LatestBlockRow = {
      height: number;
      proposer_address: string | null;
      block_time: Date | string | null;
      num_txs: number | null;
      moniker: string | null;
      operator_address: string | null;
      consensus_pub_key: string | null;
      identity: string | null;
    };

    const result = await this.zigscanPostgresService.query<LatestBlockRow>(sql, [limit, offset]);

    const data = result.rows.map(row => ({
      height: Number(row.height ?? 0),
      created_at: this.formatTimestamp(row.block_time),
      txs_results_count: Number(row.num_txs ?? 0),
      proposer_address: row.proposer_address ?? null,
      moniker: row.moniker ?? null,
      operator_address: row.operator_address ?? null,
      consensus_pub_key: row.consensus_pub_key ?? null,
      identity: row.identity ?? null,
    }));

    return {
      data,
      total_count: result.rowCount,
    };
  }

  async getBlockStats(query: BlocksStatsQueryDto): Promise<BlockStats> {
    const days = Math.min(Math.max(query.days ?? 30, 1), 365);

    this.logger.debug(`Fetching block stats for last ${days} days`);

    const [timeStats] = await this.clickhouseService.executeQuery<{
      avg_block_time_seconds: number | null;
      min_block_time_seconds: number | null;
    }>(`
      WITH block_intervals AS (
          SELECT
              b.height AS height,
              dateDiff(
                      'second',
                      lagInFrame(b.block_time) OVER (ORDER BY b.height),
                      b.block_time
              ) AS block_time
          FROM public_blocks AS b
      )
      SELECT
          avgIf(block_time, block_time IS NOT NULL AND height > 1000000) AS avg_block_time_seconds,
          minIf(block_time, block_time IS NOT NULL AND height > 1000000) AS min_block_time_seconds
      FROM block_intervals
    `);

    const [txStats] = await this.clickhouseService.executeQuery<{
      avg_txs_per_block: number | null;
    }>(`
      SELECT
        count() / countDistinct(height) AS avg_txs_per_block
      FROM public_transactions
    `);

    const blocksPerDayRows = await this.clickhouseService.executeQuery<{
      day: string;
      blocks: number;
    }>(`
      SELECT
        formatDateTime(toDate(block_time), '%Y-%m-%d') AS day,
        count() AS blocks
      FROM public_blocks
      WHERE block_time >= now() - INTERVAL ${days} DAY
      GROUP BY day
      ORDER BY day
    `);

    const hourlyBlocksRecentRows = await this.clickhouseService.executeQuery<{
      hour: string;
      blocks: number;
    }>(`
      WITH max_ts AS (
        SELECT MAX(block_time) AS max_time
        FROM public_blocks
      )
      SELECT
        toString(toStartOfHour(block_time)) AS hour,
        count(*) AS blocks
      FROM public_blocks
      CROSS JOIN max_ts
      WHERE max_ts.max_time IS NOT NULL
        AND block_time >= max_ts.max_time - INTERVAL 24 HOUR
        AND block_time < max_ts.max_time
      GROUP BY hour
      ORDER BY hour DESC
    `);

    const blocksPerDay = blocksPerDayRows.reduce<Record<string, number>>((acc, row) => {
      if (row.day) {
        acc[row.day] = Number(row.blocks ?? 0);
      }
      return acc;
    }, {});

    const hourly_blocks = hourlyBlocksRecentRows.map(row => ({
      hour: row.hour,
      blocks: Number(row.blocks ?? 0),
    }));

    return {
      avg_block_time_seconds: timeStats?.avg_block_time_seconds ?? null,
      min_block_time_seconds: timeStats?.min_block_time_seconds ?? null,
      avg_txs_per_block: txStats?.avg_txs_per_block ?? null,
      blocks_per_day: blocksPerDay,
      hourly_blocks,
    };
  }

  async getBlockTransactions(height: number): Promise<BlockTransaction[]> {
    const sql = `
      WITH recent AS (
          SELECT *
          FROM address_transactions
          WHERE height = $1  -- Filter by specific block height
      ),

      uniq AS (
          SELECT DISTINCT ON (tx_hash)
              tx_hash, address, height, tx_index, block_time, code, success, event_types, tx_data
          FROM recent
          ORDER BY tx_hash, height DESC
      )

      SELECT
          u.tx_hash,
          u.height,
          u.block_time,
          u.code,
          u.event_types,

          /* ------------------------------- SIGNER ------------------------------- */
          COALESCE(
                  (SELECT e.attributes ->> 'fee_payer'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'tx'
                     AND (e.attributes ->> 'fee_payer') IS NOT NULL LIMIT 1),
                  (SELECT e.attributes ->> 'sender'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'message'
                     AND (e.attributes ->> 'msg_index') = '0' LIMIT 1)
          ) AS signer,

          /* ------------------------------- RECIPIENT ---------------------------- */
          COALESCE(
                  (SELECT e.attributes ->> 'receiver'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'wasm'
                     AND e.attributes ->> 'msg_index' = '0' LIMIT 1),
                  (SELECT e.attributes ->> 'validator'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type IN
                                                   ('create_validator','delegate')
                     AND e.attributes ->> 'msg_index'='0' LIMIT 1),
                  (SELECT e.attributes ->> 'delegator'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'withdraw_rewards'
                     AND e.attributes ->> 'msg_index'='0' LIMIT 1),
                  (SELECT e.attributes ->> 'recipient'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'transfer'
                     AND e.attributes ->> 'msg_index'='0' LIMIT 1),
                  (SELECT e.attributes ->> 'receiver'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'ibc_transfer'
                     AND e.attributes ->> 'msg_index'='0' LIMIT 1)
          ) AS recipient,

          /* ------------------------------- AMOUNT ------------------------------- */
          COALESCE(
                  (SELECT CASE
                              WHEN e.attributes ->> 'offer_amount' IS NOT NULL
                                  THEN (e.attributes ->> 'offer_amount') ||
                                       (e.attributes ->> 'offer_asset')
                              WHEN e.attributes ->> 'return_amount' IS NOT NULL
                                  THEN (e.attributes ->> 'return_amount') ||
                                       (e.attributes ->> 'ask_asset')
                              END
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type = 'wasm'
                     AND e.attributes ->> 'msg_index'='0' LIMIT 1),
                  (SELECT e.attributes ->> 'amount'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type IN
                                                   ('withdraw_rewards','delegate','create_validator')
                     AND e.attributes ->> 'msg_index'='0' LIMIT 1),
                  (SELECT e.attributes ->> 'amount'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type='coin_spent'
                     AND e.attributes ->> 'msg_index'='0'
                     AND e.attributes ->> 'spender' = u.address LIMIT 1),
                  (SELECT e.attributes ->> 'amount'
                   FROM events e
                   WHERE e.tx_hash = u.tx_hash AND e.event_type='coin_received'
                     AND e.attributes ->> 'msg_index'='0'
                     AND e.attributes ->> 'receiver' = u.address LIMIT 1)
          ) AS amount,

          /* ------------------------------- FEE ---------------------------------- */
          (SELECT e.attributes ->> 'fee'
           FROM events e
           WHERE e.tx_hash = u.tx_hash AND e.event_type='tx'
             AND e.attributes ->> 'fee' IS NOT NULL
           LIMIT 1) AS fee_amount,

          /* -------------------------- MESSAGE TYPE ------------------------------ */
          (SELECT COALESCE(e.action, e.attributes ->> 'action')
           FROM events e
           WHERE e.tx_hash = u.tx_hash AND e.event_type='message'
             AND e.attributes ->> 'msg_index'='0'
           LIMIT 1) AS message_type,

          /* ------------------------ DIRECTION (sent/received) ------------------- */
          CASE
              WHEN EXISTS (
                  SELECT 1 FROM events e
                  WHERE e.tx_hash=u.tx_hash AND e.event_type='coin_spent'
                    AND e.attributes ->> 'spender'=u.address
                    AND e.attributes ->> 'msg_index'='0'
              ) THEN 'sent'
              WHEN EXISTS (
                  SELECT 1 FROM events e
                  WHERE e.tx_hash=u.tx_hash AND e.event_type='coin_received'
                    AND e.attributes ->> 'receiver'=u.address
                    AND e.attributes ->> 'msg_index'='0'
              ) THEN 'received'
              ELSE 'other'
          END AS direction

      FROM uniq u
      ORDER BY u.height DESC, u.tx_index DESC
      LIMIT 100
    `;

    this.logger.debug(`Fetching transactions for block ${height}`);

    type BlockTransactionRow = {
      height: number | null;
      tx_hash: string | null;
      block_time: Date | string | null;
      code: number | null;
      event_types: string | string[] | null;
      signer: string | null;
      recipient: string | null;
      amount: string | null;
      fee_amount: string | null;
      message_type: string | null;
      direction: 'sent' | 'received' | 'other' | null;
    };

    const result = await this.zigscanPostgresService.query<BlockTransactionRow>(sql, [height]);

    return result.rows.map(row => {
      const rawEventTypes = row.event_types;
      const formattedEventTypes =
        rawEventTypes == null
          ? null
          : Array.isArray(rawEventTypes)
            ? rawEventTypes.join(',')
            : String(rawEventTypes);

      const status = row.code === null || row.code === undefined ? null : Number(row.code);

      const direction =
        row.direction === 'sent' ? 'sent' : row.direction === 'received' ? 'received' : 'other';

      const messageType = row.message_type ?? null;

      return {
        height: Number(row.height ?? 0),
        tx_hash: row.tx_hash ?? '',
        created_at: this.formatTimestamp(row.block_time),
        action_type: messageType,
        status,
        signer: row.signer ?? null,
        recipient: row.recipient ?? null,
        amount: row.amount ?? null,
        fee_amount: row.fee_amount ?? null,
        event_types: formattedEventTypes,
        direction,
        message_type: messageType,
      };
    });
  }

  private formatTimestamp(value: Date | string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }

  async getBlockDetail(height: number): Promise<Record<string, unknown>> {
    type ServiceError = Error & { status?: number };

    try {
      const response = await this.blockchainService.getFromApi<Record<string, unknown>>(
        `/cosmos/base/tendermint/v1beta1/blocks/${height}`,
      );

      if (response.status === 200 && response.data) {
        return response.data;
      }

      if (response.status === 404) {
        const notFoundError = new Error(`Block ${height} not found`) as ServiceError;
        notFoundError.status = 404;
        throw notFoundError;
      }

      const upstreamError = new Error(
        `Failed to fetch block ${height}: HTTP ${response.status}`,
      ) as ServiceError;
      upstreamError.status = response.status;
      throw upstreamError;
    } catch (error) {
      const errorWithStatus = error as { status?: number };
      const status =
        typeof errorWithStatus?.status === 'number' ? errorWithStatus.status : undefined;
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (status === 404) {
        this.logger.warn(`Block ${height} not found: ${message}`);
      } else {
        this.logger.error(`Failed to fetch block ${height}: ${message}`);
      }

      if (error instanceof Error) {
        (error as ServiceError).status = status;
        throw error;
      }

      const unknownError = new Error(message) as ServiceError;
      unknownError.status = status;
      throw unknownError;
    }
  }
}
