import { Injectable, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  AccountDetails,
  AccountTransaction,
  AccountTransactionsResponse,
  ClaimableRewards,
  DelegationList,
  TokenMetadata,
  TokenWithMetadata,
} from '../dto/schema.dto';
import { ZigscanPostgresService } from '../zigscan-postgres/zigscan-postgres.service';
import { AccountTransactionsQueryDto } from './dto/account-transactions-query.dto';
import { ClickhouseService } from '../clickhouse/clickhouse.service';

interface BalanceItem {
  denom: string;
  amount: string;
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  // Cached registry asset list (in-memory, soft TTL)
  private registryAssetList: {
    chain_name: string;
    assets: Array<{
      base: string;
      name?: string;
      display?: string;
      symbol?: string;
      description?: string;
      extended_description?: string;
      logo_URIs?: { png?: string; svg?: string };
      images?: Array<{ png?: string; svg?: string }>;
      denom_units?: Array<{ denom: string; exponent: number; aliases?: string[] }>;
    }>;
  } | null = null;
  private registryFetchedAt = 0;
  private readonly registryTtlMs = 6 * 60 * 60 * 1000; // 6 hours
  private readonly registryUrl =
    'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/assetlist.json';

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly zigscanPostgresService: ZigscanPostgresService,
    private readonly clickhouseService: ClickhouseService,
  ) {}

  async getAccountDetails(address: string): Promise<AccountDetails | { error: string }> {
    const validationError = this.validateAddress(address);
    if (validationError) {
      return { error: validationError };
    }

    try {
      const [accountResponse, balanceResponse, rewardsResult] = await Promise.all([
        this.blockchainService.getFromApi<Record<string, any>>(
          `/cosmos/auth/v1beta1/accounts/${address}`,
        ),
        this.blockchainService.getFromApi<Record<string, any>>(
          `/cosmos/bank/v1beta1/balances/${address}`,
        ),
        this.getClaimableRewards(address),
      ]);

      const accountInfo = this.parseAccountInfo(accountResponse);
      if (typeof accountInfo === 'string') {
        return { error: accountInfo };
      }

      const balance = await this.parseBalances(balanceResponse);
      if (typeof balance === 'string') {
        return { error: balance };
      }

      const claimableRewards = 'error' in rewardsResult ? null : rewardsResult;
      const transactionStats = await this.fetchAccountTransactionStats(address);

      return {
        account_info: accountInfo,
        balance,
        claimable_rewards: claimableRewards,
        total_transactions: transactionStats?.total_transactions ?? null,
        first_block_height: transactionStats?.first_block_height ?? null,
        account_creation_time: transactionStats?.account_creation_time ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch account details ${address}: ${message}`);
      return { error: message };
    }
  }

  async getAccountsTotal(): Promise<{ total: number } | { error: string }> {
    try {
      const response = await this.blockchainService.getFromApi<Record<string, any>>(
        '/cosmos/auth/v1beta1/accounts',
        {
          params: {
            'pagination.count_total': true,
            'pagination.limit': 1,
          },
        },
      );

      if (response.status >= 400) {
        return { error: `Failed to fetch accounts total: HTTP ${response.status}` };
      }

      const rawTotal = response.data?.pagination?.total;

      if (rawTotal === undefined || rawTotal === null) {
        return { error: 'Accounts total not available in response' };
      }

      const total = Number(rawTotal);
      if (Number.isNaN(total)) {
        return { error: `Invalid accounts total: ${rawTotal}` };
      }

      return { total };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch accounts total: ${message}`);
      return { error: message };
    }
  }

  async getAccountDelegations(address: string): Promise<DelegationList | { error: string }> {
    const validationError = this.validateAddress(address);
    if (validationError) {
      return { error: validationError };
    }

    try {
      const response = await this.blockchainService.getFromApi<DelegationList>(
        `/cosmos/staking/v1beta1/delegations/${address}`,
        {
          params: {
            'pagination.count_total': true,
          },
        },
      );

      if (response.status === 200 && response.data) {
        const payload = response.data as Partial<DelegationList>;
        const delegationResponses = Array.isArray(payload.delegation_responses)
          ? payload.delegation_responses
          : [];

        const paginationSource = payload.pagination ?? { next_key: null, total: '0' };
        const pagination = {
          next_key: paginationSource.next_key ?? null,
          total:
            typeof paginationSource.total === 'string'
              ? paginationSource.total
              : String(paginationSource.total ?? '0'),
        } as DelegationList['pagination'];

        return {
          delegation_responses: delegationResponses,
          pagination,
        };
      }

      if (response.status === 404) {
        return {
          delegation_responses: [],
          pagination: { next_key: null, total: '0' },
        };
      }

      return { error: `Failed to fetch delegations: HTTP ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch delegations for ${address}: ${message}`);
      return { error: message };
    }
  }

  async getClaimableRewards(address: string): Promise<ClaimableRewards | { error: string }> {
    const validationError = this.validateAddress(address);
    if (validationError) {
      return { error: validationError };
    }

    try {
      const response = await this.blockchainService.getFromApi<ClaimableRewards>(
        `/cosmos/distribution/v1beta1/delegators/${address}/rewards`,
      );

      if (response.status === 200 && response.data) {
        const data = response.data;

        // Convert uzig to ZIG (divide by 1,000,000)
        let totalZig: string | null = null;
        if (data.total && Array.isArray(data.total)) {
          const uzigTotal = data.total.find(t => t.denom === 'uzig');
          if (uzigTotal && uzigTotal.amount) {
            const uzigAmount = parseFloat(uzigTotal.amount);
            if (!isNaN(uzigAmount)) {
              totalZig = (uzigAmount / 1_000_000).toFixed(6);
            }
          }
        }

        return {
          rewards: data.rewards || [],
          total: data.total || [],
          total_zig: totalZig,
        };
      }

      if (response.status === 404) {
        return {
          rewards: [],
          total: [],
          total_zig: null,
        };
      }

      return { error: `Failed to fetch claimable rewards: HTTP ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch claimable rewards for ${address}: ${message}`);
      return { error: message };
    }
  }

  async getAccountTransactions(
    address: string,
    pagination: AccountTransactionsQueryDto,
  ): Promise<AccountTransactionsResponse | { error: string }> {
    const validationError = this.validateAddress(address);
    if (validationError) {
      return { error: validationError };
    }

    const limit = Math.min(Math.max(Number(pagination.limit ?? 10), 1), 1000);
    const offset = Math.max(Number(pagination.offset ?? 0), 0);

    type AccountTransactionRow = {
      tx_hash: string | null;
      height: number | null;
      block_time: Date | string | null;
      code: number | null;
      signer: string | null;
      recipient: string | null;
      amount: string | null;
      fee_amount: string | null;
      message_type: string | null;
      contract_action: string | null;
      direction: 'sent' | 'received' | 'contract' | 'other' | null;
      event_types: string | string[] | null;
      raw_wasm: Record<string, unknown>[] | null;
    };
    const actionFilter = pagination.action_type?.trim();
    const hasActionFilter = Boolean(actionFilter);
    const actionComparison = hasActionFilter && actionFilter!.includes('%') ? 'LIKE' : '=';

    const messageTypeLookup = `
        SELECT COALESCE(e.action, e.attributes ->> 'action')
        FROM events e
        WHERE e.tx_hash = at.tx_hash
          AND e.event_type = 'message'
          AND (e.attributes ->> 'msg_index') = '0'
        LIMIT 1
    `;
    const messageTypeExpression = `(${messageTypeLookup.trim()})`;

    const buildParams = () => {
      const list: Array<string | number> = [];
      const addParam = (value: string | number): string => {
        list.push(value);
        return `$${list.length}`;
      };
      return { list, addParam };
    };

    const dataParams = buildParams();
    const addressPlaceholder = dataParams.addParam(address);
    const limitPlaceholder = dataParams.addParam(limit);
    const offsetPlaceholder = dataParams.addParam(offset);
    let actionClause = '';
    if (hasActionFilter) {
      const actionPlaceholder = dataParams.addParam(actionFilter!);
      actionClause = `AND (
                (at.code = 0 AND ${messageTypeExpression} ${actionComparison} ${actionPlaceholder})
                OR (at.code != 0)
            )`;
    }

    const totalParams = buildParams();
    totalParams.addParam(address);
    let totalActionClause = '';
    if (hasActionFilter) {
      const totalActionPlaceholder = totalParams.addParam(actionFilter!);
      totalActionClause = `AND (
                (at.code = 0 AND ${messageTypeExpression} ${actionComparison} ${totalActionPlaceholder})
                OR (at.code != 0)
            )`;
    }

    const filteredCondition = `
        (
            (at.code = 0 AND ${messageTypeExpression} LIKE '/%')
            OR (at.code != 0)
        )
    `;

    const dataSql = `
        WITH limited_txs AS (
            SELECT
                tx_hash,
                height,
                block_time,
                code,
                event_types,
                tx_data,
                address,
                tx_index
            FROM address_transactions
            WHERE address = ${addressPlaceholder}
            ORDER BY height DESC, tx_index DESC
            LIMIT 5000
        ),
        filtered_txs AS (
            SELECT *
            FROM limited_txs at
            WHERE ${filteredCondition}
            ${actionClause}
            ORDER BY at.height DESC, at.tx_index DESC
            LIMIT ${limitPlaceholder}
            OFFSET ${offsetPlaceholder}
        )
        SELECT
            at.tx_hash,
            at.height,
            at.block_time,
            at.code,
            at.event_types,
            CASE
                WHEN ${messageTypeExpression} = '/cosmwasm.wasm.v1.MsgExecuteContract' THEN (
                    SELECT jsonb_agg(event)
                    FROM jsonb_array_elements(at.tx_data::jsonb -> 'tx_result' -> 'events') AS event
                    WHERE event ->> 'type' = 'wasm'
                )
                ELSE NULL
            END AS raw_wasm,
            COALESCE(
                (SELECT e.attributes ->> 'fee_payer'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'tx'
                   AND (e.attributes ->> 'fee_payer') IS NOT NULL
                 LIMIT 1),
                (SELECT e.attributes ->> 'sender'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'message'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1)
            ) AS signer,
            COALESCE(
                (SELECT e.attributes ->> 'validator'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'create_validator'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'validator'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'delegate'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'delegator'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'withdraw_rewards'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'recipient'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'transfer'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'receiver'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'ibc_transfer'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> '_contract_address'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'execute'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> '_contract_address'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'wasm'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> '_contract_address'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'instantiate'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> '_contract_address'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'migrate'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'recipient'
                  FROM events e
                  WHERE e.tx_hash = at.tx_hash
                    AND e.event_type = 'transfer'
                    AND (e.attributes ->> 'recipient') = at.address
                  LIMIT 1)
            ) AS recipient,
            COALESCE(
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'withdraw_rewards'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'coin_spent'
                   AND e.attributes ->> 'spender' = at.address
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'coin_received'
                   AND e.attributes ->> 'receiver' = at.address
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'delegate'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'create_validator'
                   AND (e.attributes ->> 'msg_index') = '0'
                 LIMIT 1),
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'wasm'
                   AND (e.attributes ->> 'msg_index') = '0'
                   AND (e.attributes ->> 'amount') IS NOT NULL
                 LIMIT 1),
                (SELECT e.attributes ->> 'pool_creation_fee'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'wasm'
                   AND (e.attributes ->> 'msg_index') = '0'
                   AND (e.attributes ->> 'pool_creation_fee') IS NOT NULL
                 LIMIT 1),
                (SELECT e.attributes ->> 'pair_creation_fee'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'wasm'
                   AND (e.attributes ->> 'msg_index') = '0'
                   AND (e.attributes ->> 'pair_creation_fee') IS NOT NULL
                 LIMIT 1),
                (SELECT e.attributes ->> 'amount'
                 FROM events e
                 WHERE e.tx_hash = at.tx_hash
                   AND e.event_type = 'transfer'
                   AND (e.attributes ->> 'sender') = at.address
                 LIMIT 1)
            ) AS amount,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM events e
                    WHERE e.tx_hash = at.tx_hash
                      AND e.event_type = 'tx'
                      AND e.attributes ->> 'fee_payer' = at.address
                ) THEN (
                    SELECT e.attributes ->> 'amount'
                    FROM events e
                    WHERE e.tx_hash = at.tx_hash
                      AND e.event_type = 'coin_spent'
                      AND e.attributes ->> 'spender' = at.address
                      AND (e.attributes ->> 'msg_index') IS NULL
                    LIMIT 1
                )
                ELSE NULL
            END AS fee_amount,
            ${messageTypeExpression} AS message_type,
            (SELECT e.attributes ->> 'action'
             FROM events e
             WHERE e.tx_hash = at.tx_hash
               AND e.event_type = 'wasm'
               AND (e.attributes ->> 'msg_index') = '0'
             LIMIT 1) AS contract_action,
            CASE
                WHEN at.code != 0 THEN 'failed'
                WHEN EXISTS (
                    SELECT 1
                    FROM events e
                    WHERE e.tx_hash = at.tx_hash
                      AND e.event_type = 'coin_spent'
                      AND e.attributes ->> 'spender' = at.address
                      AND (e.attributes ->> 'msg_index') = '0'
                ) THEN 'sent'
                WHEN EXISTS (
                    SELECT 1
                    FROM events e
                    WHERE e.tx_hash = at.tx_hash
                      AND e.event_type = 'coin_received'
                      AND e.attributes ->> 'receiver' = at.address
                      AND (e.attributes ->> 'msg_index') = '0'
                ) THEN 'received'
                WHEN EXISTS (
                    SELECT 1
                    FROM events e
                    WHERE e.tx_hash = at.tx_hash
                      AND e.event_type IN ('execute', 'wasm', 'instantiate', 'migrate')
                      AND (e.attributes ->> 'msg_index') = '0'
                ) THEN 'contract'
                ELSE 'other'
            END AS direction
        FROM filtered_txs at
        ORDER BY at.height DESC, at.tx_index DESC
    `;

    const totalSql = `
        WITH limited_txs AS (
            SELECT
                tx_hash,
                height,
                block_time,
                code,
                event_types,
                address,
                tx_index
            FROM address_transactions
            WHERE address = $1
            ORDER BY height DESC, tx_index DESC
            LIMIT 10000
        )
        SELECT COUNT(*) AS total_count
        FROM limited_txs at
        WHERE ${filteredCondition}
        ${totalActionClause}
    `;

    try {
      const [rowsResult, totalRowsResult] = await Promise.all([
        this.zigscanPostgresService.query<AccountTransactionRow>(dataSql, dataParams.list),
        this.zigscanPostgresService.query<{ total_count: number }>(totalSql, totalParams.list),
      ]);

      const totalCount = Number(totalRowsResult.rows[0]?.total_count ?? 0) || 0;

      return {
        data: rowsResult.rows.map(row => ({
          height: Number(row.height ?? 0),
          tx_hash: row.tx_hash ?? '',
          action_type: row.message_type ?? null,
          status: row.code ?? null,
          signer: row.signer ?? null,
          created_at: this.formatTimestamp(row.block_time),
          recipient: row.recipient ?? null,
          amount: row.amount ?? null,
          fee_amount: row.fee_amount ?? null,
          event_types: row.event_types ?? null,
          direction: row.direction ?? 'other',
          message_type: row.message_type ?? null,
          contract_action: row.contract_action ?? null,
          raw_wasm: row.raw_wasm ?? null,
        })),
        total_count: totalCount,
        limit,
        offset,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch transactions for account ${address}: ${message}`);
      return { error: message };
    }
  }

  private validateAddress(address: string): string | null {
    if (address.startsWith('zigvaloper')) {
      return "Validator operator addresses are not supported. Please use a regular account address (starting with 'zig1')";
    }

    if (address.startsWith('zig1') && address.length > 50) {
      return 'Contract addresses are not supported for account details. Please use a regular account address';
    }

    if (!address.startsWith('zig1')) {
      return "Invalid address format. Address must start with 'zig1'";
    }

    return null;
  }

  private formatTimestamp(value: Date | string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }

  private async fetchAccountTransactionStats(address: string): Promise<{
    total_transactions: number;
    first_block_height: number | null;
    account_creation_time: string | null;
  } | null> {
    const escapedAddress = address.replace(/'/g, "''");
    const sql = `
SELECT
    count() AS total_transactions,
    min(height) AS first_block_height,
    min(block_time) AS account_creation_time
FROM public_address_transactions
WHERE address = '${escapedAddress}'
`;

    try {
      const [row] = await this.clickhouseService.executeQuery<{
        total_transactions: number | string;
        first_block_height: number | string | null;
        account_creation_time: string | null;
      }>(sql);

      if (!row) {
        return null;
      }

      const totalTransactions = Number(row.total_transactions ?? 0);
      const firstBlockHeight =
        row.first_block_height !== undefined && row.first_block_height !== null
          ? Number(row.first_block_height)
          : null;
      const creationTime = this.formatTimestamp(row.account_creation_time) || null;

      return {
        total_transactions: Number.isFinite(totalTransactions) ? totalTransactions : 0,
        first_block_height: Number.isFinite(firstBlockHeight ?? NaN) ? firstBlockHeight : null,
        account_creation_time: creationTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to fetch transaction stats for ${address}: ${message}`);
      return null;
    }
  }

  private parseAccountInfo(
    response: AxiosResponse<Record<string, any>>,
  ): Record<string, any> | string {
    if (response.status === 200 && response.data?.account) {
      return response.data.account as Record<string, any>;
    }

    if (response.status === 404) {
      return 'Account not found';
    }

    if (response.status >= 400) {
      return `Failed to fetch account info: HTTP ${response.status}`;
    }

    return {};
  }

  private async parseBalances(
    response: AxiosResponse<Record<string, any>>,
  ): Promise<AccountDetails['balance'] | string> {
    if (response.status === 404) {
      return {
        factory: null,
        cw20: null,
        IBC: null,
      };
    }

    if (response.status >= 400) {
      return `Failed to fetch balance: HTTP ${response.status}`;
    }

    if (!response.data?.balances) {
      return {
        factory: null,
        cw20: null,
        IBC: null,
      };
    }

    const rawBalances = response.data.balances as BalanceItem[];
    const validBalances = rawBalances.filter(item => {
      const denom = item.denom;
      return !denom.startsWith('zp') && !denom.toLowerCase().includes('lptoken');
    });

    const metadataResults = await Promise.all(
      validBalances.map(item => this.getTokenMetadata(item.denom)),
    );

    const factoryTokens: TokenWithMetadata[] = [];
    const cw20Tokens: TokenWithMetadata[] = [];
    const ibcTokens: TokenWithMetadata[] = [];

    for (let index = 0; index < validBalances.length; index += 1) {
      const balanceItem = validBalances[index];
      const denom = balanceItem.denom;
      const metadata = metadataResults[index];

      const tokenData: TokenWithMetadata = {
        denom,
        amount: balanceItem.amount,
        metadata,
      };

      if (denom === 'uzig') {
        factoryTokens.push(tokenData);
      } else if (denom.startsWith('ibc/')) {
        ibcTokens.push(tokenData);
      } else if (denom.startsWith('coin.')) {
        factoryTokens.push(tokenData);
      } else {
        cw20Tokens.push(tokenData);
      }
    }

    return {
      factory: factoryTokens.length > 0 ? factoryTokens : null,
      cw20: cw20Tokens.length > 0 ? cw20Tokens : null,
      IBC: ibcTokens.length > 0 ? ibcTokens : null,
    };
  }

  private async getTokenMetadata(denom: string): Promise<TokenMetadata> {
    try {
      // 1) Try Cosmos chain-registry asset list first for richest metadata
      const registryAsset = await this.getRegistryAssetByBase(denom);
      if (registryAsset) {
        const display = registryAsset.display;
        const denomUnits = registryAsset.denom_units ?? [];
        // Find decimals from the display unit if present, otherwise max exponent
        const displayUnit = denomUnits.find(u => u.denom === display);
        const maxUnit = denomUnits.reduce((acc, u) => (u.exponent > acc.exponent ? u : acc), {
          denom: denom,
          exponent: 0,
        } as { denom: string; exponent: number });
        const decimals = (displayUnit?.exponent ?? maxUnit.exponent) || 0;

        const imageUrl =
          registryAsset.logo_URIs?.png ||
          registryAsset.logo_URIs?.svg ||
          registryAsset.images?.[0]?.png ||
          registryAsset.images?.[0]?.svg ||
          (await this.getTokenImageUrl(denom, registryAsset.symbol || registryAsset.name || denom));

        return {
          name: registryAsset.name || denom,
          symbol: registryAsset.symbol || display?.toUpperCase() || denom.toUpperCase(),
          description: registryAsset.extended_description || registryAsset.description || 'Token',
          decimals,
          image_url: imageUrl,
        };
      }

      // 2) Fallbacks when registry entry not available
      if (denom === 'uzig') {
        return {
          name: 'ZIG',
          symbol: 'ZIG',
          description: 'Native ZigChain token',
          decimals: 6,
          image_url: await this.getTokenImageUrl(denom, 'ZIG'),
        };
      }

      if (denom.startsWith('ibc/')) {
        const ibcHash = denom.replace('ibc/', '');
        const response = await this.blockchainService.getFromApi<Record<string, any>>(
          `/ibc/apps/transfer/v1/denom_traces/${ibcHash}`,
        );

        if (response.status === 200 && response.data?.denom_trace) {
          const trace = response.data.denom_trace as Record<string, any>;
          const baseDenom = (trace.base_denom as string) ?? denom;

          // Derive a human-friendly symbol from the base denom.
          // Common pattern: micro-denoms start with 'u' (e.g., 'uatom' -> 'ATOM').
          let symbol = baseDenom;
          if (typeof baseDenom === 'string') {
            if (baseDenom.startsWith('u') && baseDenom.length > 1) {
              symbol = baseDenom.substring(1).toUpperCase();
            } else if (baseDenom.includes('-')) {
              // some denoms use hyphens, take the last segment
              const parts = baseDenom.split('-');
              symbol = parts[parts.length - 1].toUpperCase();
            } else {
              symbol = baseDenom.toUpperCase();
            }
          }

          return {
            name: baseDenom,
            symbol,
            description: `IBC token from ${trace.path ?? 'unknown'}`,
            // default decimals for IBC assets commonly follow their base denom (6 assumed here)
            decimals: 6,
            image_url: await this.getTokenImageUrl(denom, baseDenom),
          };
        }
      }

      if (denom.startsWith('coin.')) {
        // Fetch factory token metadata from the chain API
        const metadataRes = await this.blockchainService.getFromApi<Record<string, any>>(
          `/cosmos/bank/v1beta1/denoms_metadata/${encodeURIComponent(denom)}`,
        );

        if (metadataRes.status === 200 && metadataRes.data?.metadata) {
          const meta = metadataRes.data.metadata;
          const denomUnits: Array<{ denom: string; exponent: number; aliases?: string[] }> =
            meta.denom_units ?? [];

          // Find the display unit or max exponent
          const displayDenom = meta.display || meta.base || denom;
          const displayUnit = denomUnits.find(u => u.denom === displayDenom);
          const maxUnit = denomUnits.reduce((acc, u) => (u.exponent > acc.exponent ? u : acc), {
            denom: denom,
            exponent: 0,
          });
          const decimals = displayUnit?.exponent ?? maxUnit.exponent ?? 0;

          // If URI points to IPFS/Pinata metadata, fetch the actual icon
          let imageUrl = meta.uri || (await this.getTokenImageUrl(denom, meta.symbol || denom));
          if (meta.uri) {
            imageUrl = await this.resolveTokenImageFromUri(meta.uri);
          }

          return {
            name: meta.name || meta.symbol || denom,
            symbol: meta.symbol || displayDenom.toUpperCase(),
            description: meta.description || `Factory token: ${meta.symbol || denom}`,
            decimals,
            image_url: imageUrl,
          };
        }

        // Fallback if metadata API fails
        const parts = denom.split('.');
        if (parts.length >= 3) {
          const tokenName = parts[2];
          return {
            name: tokenName,
            symbol: tokenName.toUpperCase(),
            description: `Factory token: ${tokenName}`,
            decimals: 6,
            image_url: await this.getTokenImageUrl(denom, tokenName),
          };
        }
      }

      return {
        name: denom,
        symbol: denom,
        description: 'Unknown token',
        decimals: 0,
        image_url: await this.getTokenImageUrl(denom, denom),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token metadata unavailable';
      return {
        name: denom,
        symbol: denom,
        description: message,
        decimals: 0,
        image_url: await this.getTokenImageUrl(denom, denom),
      };
    }
  }

  async getMetadataForDenom(
    denom: string,
  ): Promise<{ denom: string; metadata: TokenMetadata } | { error: string }> {
    if (!denom) {
      return { error: 'Denom is required' };
    }

    try {
      const metadata = await this.getTokenMetadata(denom);
      return { denom, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error fetching metadata';
      this.logger.warn(`Failed to resolve metadata for ${denom}: ${message}`);
      return { error: `Failed to resolve metadata: ${message}` };
    }
  }

  private async resolveTokenImageFromUri(uri: string): Promise<string> {
    try {
      // Check if URI points to IPFS (Pinata or other gateways)
      if (uri.includes('ipfs/') || uri.includes('/ipfs/')) {
        const response = await axios.get<{ icon?: string; image?: string }>(uri, {
          validateStatus: () => true,
          timeout: 10000,
        });

        if (response.status === 200 && response.data) {
          // Return the icon or image field from the metadata JSON
          const iconUrl = response.data.icon || response.data.image;
          if (iconUrl) {
            return iconUrl;
          }
        }
      }

      // If not IPFS or fetch failed, return the URI as-is
      return uri;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to resolve token image from URI ${uri}: ${message}`);
      return uri;
    }
  }

  private async getRegistryAssetByBase(baseDenom: string) {
    try {
      const now = Date.now();
      if (!this.registryAssetList || now - this.registryFetchedAt > this.registryTtlMs) {
        const res = await axios.get(this.registryUrl, {
          validateStatus: () => true,
          timeout: 15000,
        });
        if (res.status === 200 && res.data?.assets) {
          this.registryAssetList = res.data as typeof this.registryAssetList;
          this.registryFetchedAt = now;
        } else {
          this.logger.warn(`Failed to refresh registry asset list: HTTP ${res.status}`);
        }
      }

      const list = this.registryAssetList;
      if (!list?.assets?.length) return null;
      return list.assets.find(a => a.base === baseDenom) ?? null;
    } catch (e) {
      this.logger.warn(
        `Error fetching registry asset list: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  private async getTokenImageUrl(denom: string, tokenName: string): Promise<string> {
    try {
      if (denom === 'uzig') {
        return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/zigchain.png';
      }

      switch (denom) {
        case 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4':
          return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/usdc.png';
        case 'ibc/EF48E6B1A1A19F47ECAEA62F5670C37C0580E86A9E88498B7E393EB6F49F33C0':
          return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png';
        case 'ibc/9BEE293E6559ED860CC702685996F394D4991D6DFFD60A19ABC3723E6F34788A':
          return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/zigchain.png';
        case 'ibc/0E1517E2771CA7C03F2ED3F9BAECCAEADF0BFD79B89679E834933BC0F179AD98':
          return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/usdc.png';
        case 'coin.zig109f7g2rzl2aqee7z6gffn8kfe9cpqx0mjkk7ethmx8m2hq4xpe9snmaam2.stzig':
          return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/stzig.png';
        default:
          break;
      }

      if (denom.startsWith('coin.')) {
        const lower = tokenName.toLowerCase();
        if (lower.includes('panda') || lower.includes('quote') || lower.includes('zyx')) {
          return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/zigchain.png';
        }
        return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/zigchain.png';
      }

      if (denom.startsWith('ibc/')) {
        return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/_non-cosmos/ethereum/images/usdc.png';
      }

      return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/zigchain.png';
    } catch {
      return 'https://raw.githubusercontent.com/cosmos/chain-registry/master/zigchain/images/zigchain.png';
    }
  }
}
