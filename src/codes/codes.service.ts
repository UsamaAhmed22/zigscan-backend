import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ZigscanPostgresService } from '../zigscan-postgres/zigscan-postgres.service';
import { CodeDetails, CodeStore, CodesResponse } from '../dto/schema.dto';
import { CodesQueryDto } from './dto/codes-query.dto';

type PostgresCodeRow = {
  tx_hash: string;
  height: number | string;
  block_time: Date | string | null;
  code?: number | string | null;
  code_id?: string | null;
  creator?: string | null;
};

@Injectable()
export class CodesService {
  private readonly logger = new Logger(CodesService.name);

  constructor(
    private readonly zigscanPostgresService: ZigscanPostgresService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async getCodeStores(query: CodesQueryDto): Promise<CodesResponse> {
    const dataSql = `
      SELECT DISTINCT
        e.tx_hash,
        t.height,
        t.block_time,
        t.code,
        e.attributes ->> 'code_id' AS code_id,
        t.addresses[1] AS creator
      FROM events e
      INNER JOIN transactions t ON e.tx_hash = t.tx_hash
      WHERE e.event_type = 'store_code'
      ORDER BY t.block_time DESC
      LIMIT 80
    `;

    const result = await this.zigscanPostgresService.query<PostgresCodeRow>(dataSql);

    return {
      data: result.rows.map(row => ({
        tx_hash: row.tx_hash,
        height: Number(row.height ?? 0),
        code: typeof row.code === 'number' ? row.code : row.code ? Number(row.code) : null,
        created_at: this.formatTimestamp(row.block_time),
        code_id: row.code_id ?? null,
        creator: row.creator ?? null,
        sender: row.creator ?? null,
      })),
      total_count: result.rowCount,
    };
  }

  private formatTimestamp(value?: Date | string | null): string {
    if (value == null) {
      return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  }

  async getCodeDetails(codeId: string): Promise<CodeDetails | { error: string }> {
    try {
      const [codeInfoResponse, contractsResponse] = await Promise.all([
        this.blockchainService.getFromApi<Record<string, any>>(`/cosmwasm/wasm/v1/code/${codeId}`),
        this.blockchainService.getFromApi<Record<string, any>>(
          `/cosmwasm/wasm/v1/code/${codeId}/contracts`,
        ),
      ]);

      let codeInfoData: CodeDetails['code_info'] = null;
      if (codeInfoResponse.status === 200 && codeInfoResponse.data) {
        const raw = codeInfoResponse.data;
        if (raw.code_info) {
          const apiCodeInfo = raw.code_info as Record<string, any>;
          codeInfoData = {
            code_id: apiCodeInfo.code_id,
            creator: apiCodeInfo.creator,
            instantiate_permission: apiCodeInfo.instantiate_permission ?? undefined,
          };
        }
      }

      const contractsData =
        contractsResponse.status === 200 ? (contractsResponse.data as Record<string, any>) : null;

      return {
        code_info: codeInfoData,
        contracts: contractsData,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch code details ${codeId}: ${message}`);
      return { error: message };
    }
  }
}
