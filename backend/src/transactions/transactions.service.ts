import { Injectable, Logger } from '@nestjs/common';
import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { LatestTxResponse, TransactionStats } from '../dto/schema.dto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ZigscanPostgresService } from '../zigscan-postgres/zigscan-postgres.service';

// Example Response
// {
//   "height": "1234567",
//   "tx_hash": "38E83AD849B7A3699B00289B2FA0CDD2B72DA9F9064BFFF0BDA8AD5765E2076E",
//   "action_type": "/cosmos.bank.v1beta1.MsgSend",
//   "status": 0,
//   "signer": "zig1d3m4g5x5j6k7l8m9n0pqrstu5vwxz6y7z8a9b0c",
//   "created_at": "2025-10-10 14:04:46.591000"

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly clickhouseService: ClickhouseService,
    private readonly blockchainService: BlockchainService,
    private readonly zigscanPostgresService: ZigscanPostgresService,
  ) {}

  async getTransactionStats(): Promise<TransactionStats | Record<string, never>> {
    const metricsSql = `
      SELECT
        count() as tx_total,
        countIf(block_time >= now() - INTERVAL 30 DAY) as tx_last_30d,
        countIf(block_time >= now() - INTERVAL 15 DAY) as tx_last_15d,
        countIf(block_time >= now() - INTERVAL 7 DAY) as tx_last_7d,
        count() / dateDiff('second', min(block_time), max(block_time)) as tps_all_time,
        countIf(success = true) / dateDiff('second', min(block_time), max(block_time)) as true_tps_all_time
      FROM public_transactions
    `;

    const hourlySql = `
      WITH max_ts AS (
        SELECT MAX(block_time) AS max_time
        FROM public_transactions
      )
      SELECT
        toString(toStartOfHour(block_time)) AS hour,
        count(*) AS blocks
      FROM public_transactions
      CROSS JOIN max_ts
      WHERE max_ts.max_time IS NOT NULL
        AND block_time >= max_ts.max_time - INTERVAL 24 HOUR
        AND block_time < max_ts.max_time
      GROUP BY hour
      ORDER BY hour DESC
    `;

    const [metrics] = await this.clickhouseService.executeQuery<{
      tx_total: number;
      tx_last_30d: number;
      tx_last_15d: number;
      tx_last_7d: number;
      tps_all_time: number;
      true_tps_all_time: number;
    }>(metricsSql);

    if (!metrics) {
      return {};
    }

    const hourlyRows = await this.clickhouseService.executeQuery<{
      hour: string;
      blocks: number;
    }>(hourlySql);

    const hourly_blocks = hourlyRows.map(row => ({
      hour: row.hour,
      blocks: Number(row.blocks ?? 0),
    }));

    const hourly_txns = hourly_blocks.reduce<Record<string, number>>((acc, row) => {
      if (row.hour) {
        acc[row.hour] = row.blocks;
      }
      return acc;
    }, {});

    return {
      tx_total: Number(metrics.tx_total ?? 0),
      tx_last_30d: Number(metrics.tx_last_30d ?? 0),
      tx_last_15d: Number(metrics.tx_last_15d ?? 0),
      tx_last_7d: Number(metrics.tx_last_7d ?? 0),
      hourly_txns,
      hourly_blocks,
      tps_all_time: Number(metrics.tps_all_time ?? 0),
      true_tps_all_time: Number(metrics.true_tps_all_time ?? 0),
    };
  }

  async getTransactionDetail(txHash: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.blockchainService.getFromApi<Record<string, any>>(
        `/cosmos/tx/v1beta1/txs/${txHash}`,
      );

      if (response.status === 200 && response.data) {
        const txData = { ...response.data };
        if (txData.tx_response?.tx) {
          delete txData.tx_response.tx;
        }
        return txData;
      }

      if (response.status === 404) {
        return { error: 'Transaction not found' };
      }

      return { error: `API error: HTTP ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch transaction ${txHash}: ${message}`);
      return { error: `Failed to fetch transaction: ${message}` };
    }
  }

  async getLatestTransactions(
    limit = 10,
    offset = 0,
    action?: string,
    startDate?: string,
    endDate?: string,
    heightWindow?: number,
    beforeHeight?: number,
  ): Promise<{ data: LatestTxResponse[]; total_count: number }> {
    limit = Number(limit);
    offset = Number(offset);

    if (isNaN(limit) || limit <= 0) {
      limit = 10;
    }

    if (isNaN(offset) || offset < 0) {
      offset = 0;
    }

    const params: Array<string | number | null> = [];

    const requestedHeightWindow = Number(heightWindow);

    const normalizedHeightWindow = Number.isFinite(requestedHeightWindow)
      ? Math.min(Math.max(requestedHeightWindow, 1), 100_000)
      : 1000;

    const requestedBeforeHeight = Number(beforeHeight);
    const normalizedBeforeHeight =
      Number.isFinite(requestedBeforeHeight) && requestedBeforeHeight >= 1
        ? Math.floor(requestedBeforeHeight)
        : null;
    const effectiveOffsetForCursor = normalizedBeforeHeight !== null ? offset : 0;
    const upperHeight =
      normalizedBeforeHeight !== null
        ? Math.max(normalizedBeforeHeight - effectiveOffsetForCursor, 0)
        : null;

    const addParam = (value: string | number | null): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const heightWindowPlaceholder = addParam(normalizedHeightWindow);
    const upperHeightPlaceholder = addParam(upperHeight);
    const upperHeightExpr = `${upperHeightPlaceholder}::bigint`;
    const whereConditions: string[] = [`ed.message_type LIKE '/%'`];

    if (action) {
      const placeholder = addParam(action);
      const comparison = action.includes('%') ? `LIKE ${placeholder}` : `= ${placeholder}`;
      whereConditions.push(`ed.message_type ${comparison}`);
    }

    if (startDate) {
      const placeholder = addParam(startDate);
      whereConditions.push(`u.block_time >= ${placeholder}`);
    }

    if (endDate) {
      const placeholder = addParam(endDate);
      whereConditions.push(`u.block_time < ${placeholder}`);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const sql = `
WITH max_height AS (
    SELECT MAX(height) AS height
    FROM transactions
),
bounds AS (
    SELECT
        CASE
            WHEN ${upperHeightExpr} IS NOT NULL THEN LEAST(${upperHeightExpr}, m.height)
            ELSE m.height
        END AS upper_height
    FROM max_height m
),
recent AS (
    SELECT at.*
    FROM address_transactions at
    CROSS JOIN bounds b
    WHERE at.height <= b.upper_height
      AND at.height >= b.upper_height - ${heightWindowPlaceholder}
),

uniq AS (
    SELECT DISTINCT ON (tx_hash)
        tx_hash, address, height, tx_index, block_time, code, success, event_types, tx_data
    FROM recent
    ORDER BY tx_hash, height DESC
),

event_data AS (
    SELECT
        e.tx_hash,
        MAX(CASE WHEN e.event_type = 'tx' AND e.attributes ? 'fee_payer' THEN e.attributes ->> 'fee_payer' END) AS fee_payer,
        MAX(CASE WHEN e.event_type = 'message' AND e.attributes ->> 'msg_index' = '0' THEN e.attributes ->> 'sender' END) AS sender,
        MAX(CASE
                WHEN e.event_type = 'wasm' AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'receiver' THEN '1_' || (e.attributes ->> 'receiver')
                WHEN e.event_type IN ('create_validator','delegate') AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'validator' THEN '2_' || (e.attributes ->> 'validator')
                WHEN e.event_type = 'withdraw_rewards' AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'delegator' THEN '3_' || (e.attributes ->> 'delegator')
                WHEN e.event_type = 'transfer' AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'recipient' THEN '4_' || (e.attributes ->> 'recipient')
                WHEN e.event_type = 'ibc_transfer' AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'receiver' THEN '5_' || (e.attributes ->> 'receiver')
            END) AS recipient_raw,
        MAX(CASE
                WHEN e.event_type = 'wasm' AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'offer_amount'
                    THEN '1_' || (e.attributes ->> 'offer_amount') || (e.attributes ->> 'offer_asset')
                WHEN e.event_type = 'wasm' AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'return_amount'
                    THEN '1_' || (e.attributes ->> 'return_amount') || (e.attributes ->> 'ask_asset')
                WHEN e.event_type IN ('withdraw_rewards','delegate','create_validator') AND e.attributes ->> 'msg_index' = '0' AND e.attributes ? 'amount'
                    THEN '2_' || (e.attributes ->> 'amount')
            END) AS amount_priority,
        MAX(CASE WHEN e.event_type = 'coin_spent' AND e.attributes ->> 'msg_index' = '0' THEN e.attributes ->> 'amount' END) AS coin_spent_amount,
        MAX(CASE WHEN e.event_type = 'coin_spent' AND e.attributes ->> 'msg_index' = '0' THEN e.attributes ->> 'spender' END) AS coin_spender,
        MAX(CASE WHEN e.event_type = 'coin_received' AND e.attributes ->> 'msg_index' = '0' THEN e.attributes ->> 'amount' END) AS coin_received_amount,
        MAX(CASE WHEN e.event_type = 'coin_received' AND e.attributes ->> 'msg_index' = '0' THEN e.attributes ->> 'receiver' END) AS coin_receiver,
        MAX(CASE WHEN e.event_type = 'tx' AND e.attributes ? 'fee' THEN e.attributes ->> 'fee' END) AS fee,
        MAX(CASE WHEN e.event_type = 'message' AND e.attributes ->> 'msg_index' = '0' THEN COALESCE(e.action, e.attributes ->> 'action') END) AS message_type
    FROM events e
    WHERE e.tx_hash IN (SELECT tx_hash FROM uniq)
      AND (
          e.attributes ->> 'msg_index' = '0'
          OR e.event_type = 'tx'
          OR e.attributes ->> 'msg_index' IS NULL
      )
    GROUP BY e.tx_hash
)

SELECT
    u.tx_hash,
    u.height,
    u.block_time,
    u.code,
    u.event_types,
    COALESCE(ed.fee_payer, ed.sender) AS signer,
    SUBSTRING(ed.recipient_raw FROM 3) AS recipient,
    COALESCE(
            SUBSTRING(ed.amount_priority FROM 3),
            CASE WHEN ed.coin_spender = u.address THEN ed.coin_spent_amount END,
            CASE WHEN ed.coin_receiver = u.address THEN ed.coin_received_amount END
    ) AS amount,
    ed.fee AS fee_amount,
    ed.message_type,
    CASE
        WHEN ed.coin_spender = u.address THEN 'sent'
        WHEN ed.coin_receiver = u.address THEN 'received'
        ELSE 'other'
    END AS direction
FROM uniq u
         LEFT JOIN event_data ed ON u.tx_hash = ed.tx_hash
${whereClause}
ORDER BY u.height DESC, u.tx_index DESC
LIMIT ${limit}
OFFSET ${normalizedBeforeHeight !== null ? 0 : offset};
    `;

    if (action || startDate || endDate) {
      this.logger.log('Applying ZigScan Postgres filters', { action, startDate, endDate });
    }

    const result = await this.zigscanPostgresService.query<LatestTxResponse>(sql, params);
    return {
      data: result.rows,
      total_count: result.rowCount,
    };
  }

  async getMessageTypes(): Promise<{
    data: Array<{ transaction_type: string; transaction_count: number }>;
    total_types: number;
  }> {
    const sql = `
      SELECT
          action AS message_type,
          count() AS num_txs
      FROM zigchain_mainnet_db_pg.public_events
      WHERE event_type = 'message'
        AND action LIKE '/%'
      GROUP BY action
      ORDER BY num_txs DESC
    `;

    this.logger.log('Fetching all message types with transaction counts');

    const rows = await this.clickhouseService.executeQuery<{
      message_type: string;
      num_txs: number;
    }>(sql);

    return {
      data: rows.map(row => ({
        transaction_type: row.message_type,
        transaction_count: row.num_txs,
      })),
      total_types: rows.length,
    };
  }
}
