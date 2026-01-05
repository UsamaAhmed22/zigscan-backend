import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ContractDetails,
  ContractsResponse,
  ContractTransaction,
  ContractTransactionsResponse,
  LatestContract,
} from '../dto/schema.dto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ContractsQueryDto } from './dto/contracts-query.dto';
import { ContractTransactionsQueryDto } from './dto/contract-transactions-query.dto';
import { ZigscanPostgresService } from '../zigscan-postgres/zigscan-postgres.service';

type PostgresContractTransactionRow = {
  tx_hash: string;
  height: number | string;
  block_time: Date | string | null;
  code?: number | string | null;
  event_types?: string | string[] | null;
  signer?: string | null;
  recipient?: string | null;
  amount?: string | null;
  contract_action?: string | null;
  message_type?: string | null;
  tx_data?: string | null;
};

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private readonly invalidQueryKey = '__zigscan_invalid_query__';

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly zigscanPostgresService: ZigscanPostgresService,
  ) {}

  async getContractDetails(contractAddress: string): Promise<ContractDetails | { error: string }> {
    try {
      const response = await this.blockchainService.getFromApi<Record<string, unknown>>(
        `/cosmwasm/wasm/v1/contract/${contractAddress}`,
      );

      if (response.status === 200) {
        return {
          contract_info: response.data,
        };
      }

      return { error: `Failed to fetch contract: HTTP ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch contract details ${contractAddress}: ${message}`);
      return { error: message };
    }
  }

  async getContracts(query: ContractsQueryDto): Promise<ContractsResponse> {
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 1000);
    const offset = Math.max(query.offset ?? 0, 0);

    const filterConditions: string[] = [];
    const filterParams: (string | number)[] = [];

    const creatorAddress = query.creator?.trim() ?? query.sender?.trim();
    if (creatorAddress) {
      filterParams.push(creatorAddress);
      filterConditions.push(`creator = $${filterParams.length}`);
    }

    if (query.contract_address?.trim()) {
      filterParams.push(query.contract_address.trim());
      filterConditions.push(`contract_address = $${filterParams.length}`);
    }

    if (query.code_id?.trim()) {
      filterParams.push(query.code_id.trim());
      filterConditions.push(`code_id = $${filterParams.length}`);
    }

    if (query.created_after) {
      filterParams.push(query.created_after);
      filterConditions.push(`created_at_time >= $${filterParams.length}`);
    }

    if (query.created_before) {
      filterParams.push(query.created_before);
      filterConditions.push(`created_at_time <= $${filterParams.length}`);
    }

    const whereClause =
      filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '';

    const dataSql = `
      SELECT DISTINCT
        contract_address,
        creator,
        created_at_tx_hash,
        code_id,
        label,
        created_at_time
      FROM wasm_contracts
      ${whereClause}
      ORDER BY created_at_time DESC
      LIMIT $${filterParams.length + 1}
      OFFSET $${filterParams.length + 2}
    `;

    const dataParams = [...filterParams, limit, offset];

    type LatestContractRow = {
      contract_address: string;
      creator?: string | null;
      created_at_tx_hash?: string | null;
      code_id?: string | null;
      label?: string | null;
      created_at_time?: Date | string | null;
    };

    const dataResult = await this.zigscanPostgresService.query<LatestContractRow>(
      dataSql,
      dataParams,
    );

    const countSql = `
      SELECT COUNT(DISTINCT contract_address) AS total_count
      FROM wasm_contracts
      ${whereClause}
    `;

    const countResult = await this.zigscanPostgresService.query<{ total_count: number | string }>(
      countSql,
      filterParams,
    );

    const totalCount = Number(countResult.rows[0]?.total_count ?? 0);

    return {
      data: dataResult.rows.map(
        (row): LatestContract => ({
          contract_address: row.contract_address,
          creator: row.creator ?? null,
          created_at_tx_hash: row.created_at_tx_hash ?? null,
          code_id: row.code_id ?? null,
          label: row.label ?? null,
          created_at_time: this.formatTimestamp(row.created_at_time),
        }),
      ),
      total_count: totalCount,
    };
  }

  private formatTimestamp(value?: Date | string | null): string | null {
    if (value == null) {
      return null;
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  async getContractTransactions(
    contractAddress: string,
    pagination: ContractTransactionsQueryDto,
  ): Promise<ContractTransactionsResponse> {
    const limit = Math.min(Math.max(Number(pagination.limit ?? 50), 1), 1000);
    const offset = Math.max(Number(pagination.offset ?? 0), 0);

    const normalizedContract = contractAddress.trim();

    const contractExistsResult = await this.zigscanPostgresService.query<{
      contract_address: string;
    }>(
      `
          SELECT contract_address
          FROM wasm_contracts
          WHERE contract_address = $1
          LIMIT 1
        `,
      [normalizedContract],
    );

    if (contractExistsResult.rowCount === 0) {
      this.logger.warn(`Requested contract transactions for unknown address ${normalizedContract}`);
      throw new HttpException('Invalid contract address', HttpStatus.BAD_REQUEST);
    }

    const sql = `
      WITH deduplicated_txs AS (
        SELECT DISTINCT ON (t.tx_hash)
          t.tx_hash,
          t.height,
          t.block_time,
          t.code,
          t.gas_used,
          t.tx_data,
          t.event_types,
          t.addresses[1] AS fallback_signer,
          wce.action AS contract_action,
          wce.contract_address
        FROM wasm_contract_events wce
        INNER JOIN transactions t ON wce.tx_hash = t.tx_hash
        WHERE wce.contract_address = $1
        ORDER BY t.tx_hash
      )
      SELECT
        dt.tx_hash,
        dt.height,
        dt.block_time,
        dt.code,
        dt.gas_used,
        dt.tx_data,
        dt.event_types,
        dt.contract_action,
        COALESCE(
          (SELECT e.attributes ->> 'sender'
           FROM events e
           WHERE e.tx_hash = dt.tx_hash
             AND e.event_type = 'message'
           LIMIT 1),
          dt.fallback_signer
        ) AS signer,
        COALESCE(
          dt.contract_address,
          (SELECT e.attributes ->> 'recipient'
           FROM events e
           WHERE e.tx_hash = dt.tx_hash
             AND e.event_type = 'transfer'
           LIMIT 1)
        ) AS recipient,
        (SELECT e.attributes ->> 'amount'
         FROM events e
         WHERE e.tx_hash = dt.tx_hash
           AND e.event_type IN ('coin_spent', 'coin_received', 'transfer')
           AND (e.attributes ->> 'amount') IS NOT NULL
         LIMIT 1) AS amount,
        (
          SELECT COALESCE(e.action, e.attributes ->> 'action')
          FROM events e
          WHERE e.tx_hash = dt.tx_hash
            AND e.event_type = 'message'
            AND (e.attributes ->> 'msg_index') = '0'
          LIMIT 1
        ) AS message_type
      FROM deduplicated_txs dt
      ORDER BY dt.block_time DESC
      LIMIT $2
      OFFSET $3
    `;

    const result = await this.zigscanPostgresService.query<PostgresContractTransactionRow>(sql, [
      normalizedContract,
      limit,
      offset,
    ]);

    const countSql = `
      SELECT COUNT(*) AS total_count
      FROM (
        SELECT DISTINCT ON (tx_hash) tx_hash
        FROM wasm_contract_events
        WHERE contract_address = $1
        ORDER BY tx_hash
      ) AS deduplicated
    `;

    const countResult = await this.zigscanPostgresService.query<{ total_count: number | string }>(
      countSql,
      [normalizedContract],
    );

    const totalCount = Number(countResult.rows[0]?.total_count ?? 0);

    const data = result.rows.map(row => {
      const eventTypes =
        typeof row.event_types === 'string'
          ? row.event_types
          : Array.isArray(row.event_types)
            ? row.event_types.join(', ')
            : null;

      return {
        tx_hash: row.tx_hash,
        height: Number(row.height ?? 0),
        status: typeof row.code === 'number' ? row.code : row.code ? Number(row.code) : null,
        created_at: this.formatTimestamp(row.block_time),
        signer: row.signer ?? null,
        recipient: row.recipient ?? null,
        amount: row.amount ?? null,
        tx_data: row.tx_data ?? null,
        action_type: row.message_type ?? null,
        message_type: row.message_type ?? null,
        contract_action: row.contract_action ?? null,
        event_types: eventTypes,
        direction: row.recipient ? 'received' : 'other',
      } as ContractTransaction;
    });

    return {
      data,
      total_count: totalCount,
      limit,
      offset,
    };
  }

  private autoParseValue(value: string | string[]): unknown {
    if (Array.isArray(value)) {
      return value.map(entry => this.autoParseValue(entry));
    }

    const trimmed = value.trim();

    if (/^(true|false)$/i.test(trimmed)) {
      return trimmed.toLowerCase() === 'true';
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }

    return value;
  }

  private normalizeBase64(input: string): string {
    if (!input) {
      throw new Error('txBytes must not be empty');
    }

    const sanitized = input.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(sanitized)) {
      throw new Error('txBytes must be a valid base64-encoded string');
    }

    return sanitized;
  }

  private isErrorEnvelope(
    payload: Record<string, unknown> | undefined,
  ): payload is { code: number; message?: string } {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const code = (payload as Record<string, unknown>).code;
    if (typeof code !== 'number') {
      return false;
    }

    return code !== 0;
  }

  private extractQuerySuggestions(message: string): string[] | undefined {
    const match = message.match(/expected one of ([^:]+)/i);
    if (!match) {
      return undefined;
    }

    const candidates = match[1]
      .split(',')
      .map(entry => entry.replace(/[`'"]/g, '').trim())
      .filter(entry => entry.length > 0 && entry !== this.invalidQueryKey);

    return candidates.length > 0 ? candidates : undefined;
  }

  private extractMissingField(message: string): string | undefined {
    const match = message.match(/missing field [`'"]?([a-zA-Z0-9_]+)[`'"]?/i);
    return match ? match[1] : undefined;
  }
}
