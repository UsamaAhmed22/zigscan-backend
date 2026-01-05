export interface TransactionStats {
  tx_total: number;
  tx_last_7d: number;
  tx_last_15d: number;
  tx_last_30d: number;
  hourly_txns: Record<string, number>;
  hourly_blocks?: Array<{ hour: string; blocks: number }>;
  tps_all_time: number;
  true_tps_all_time: number;
}

export interface GeneralStats {
  total_blocks: number;
  latest_height: number;
  total_transactions: number;
}

export interface LatestContract {
  contract_address: string;
  creator?: string | null;
  created_at_tx_hash?: string | null;
  code_id?: string | null;
  label?: string | null;
  created_at_time?: string | null;
}

export interface CodeStore {
  height: number;
  tx_hash: string;
  created_at: string;
  code?: number | null;
  code_id?: string | null;
  creator?: string | null;
  sender?: string | null;
}

export interface BlockSummary {
  height: number;
  app_hash?: string | null;
  txs_results_count?: number | null;
  finalize_events_count?: number | null;
  created_at: string;
}

export interface BlockValidatorReward {
  validator_address: string;
  reward_amount: string;
}

export interface BlockMintingSnapshot {
  height: number;
  created_at: string;
  txs_results_count: number;
  minter: string;
  inflation: number;
  validator_rewards: BlockValidatorReward[];
  proposer_address?: string | null;
  moniker?: string | null;
  operator_address?: string | null;
  consensus_pub_key?: string | null;
  identity?: string | null;
}

export interface BlockStats {
  avg_block_time_seconds: number | null;
  min_block_time_seconds: number | null;
  avg_txs_per_block: number | null;
  blocks_per_day: Record<string, number>;
  hourly_blocks?: Array<{ hour: string; blocks: number }>;
}

export interface BlockTransaction {
  height: number;
  tx_hash: string;
  action_type: string | null;
  status: number | null;
  signer: string | null;
  created_at: string;
  recipient: string | null;
  amount: string | null;
  fee_amount: string | null;
  event_types: string | null;
  direction: 'sent' | 'received' | 'contract' | 'other';
  message_type: string | null;
}

export interface ContractTransaction extends BlockTransaction {
  reliable_fee?: string | null;
  contract_action?: string | null;
  tx_data?: string | null;
}

export interface AccountTransaction extends BlockTransaction {
  sender?: string | null;
  contract_action?: string | null;
  raw_wasm?: Record<string, unknown>[] | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface Validator {
  operator_address?: string;
  description?: ValidatorDescription;
  commission?: ValidatorCommission;
  status?: string;
  tokens?: string;
  delegator_shares?: string;
  jailed?: boolean;
  consensus_pubkey?: Record<string, unknown>;
  min_self_delegation?: string;
  keybase_image_url?: string | null;
}

export interface ValidatorDescription {
  moniker?: string;
  identity?: string;
  website?: string;
  security_contact?: string;
  details?: string;
}

export interface ValidatorCommission {
  commission_rates?: ValidatorCommissionRates;
  update_time?: string;
}

export interface ValidatorCommissionRates {
  rate?: string;
  max_rate?: string;
  max_change_rate?: string;
}

export interface ValidatorsResponse {
  data: Validator[];
  total_count: number;
}

export interface ContractsResponse {
  data: LatestContract[];
  total_count: number;
}

export interface MemesDotFunSocialLinks {
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface MemesDotFunTokenDetails {
  token_price?: number;
  market_cap?: number;
  creator?: string;
  liquidity?: number;
  volume?: number;
  supply?: number;
  last_trade_time?: number;
  trade_count?: number;
  holder_count?: number;
  twentyfour_hour_volume?: number;
}

export interface MemesDotFunCoin {
  name?: string;
  symbol?: string;
  token?: string;
  description?: string;
  logo?: string;
  socials_links?: MemesDotFunSocialLinks;
  token_details?: MemesDotFunTokenDetails;
  created_at?: string;
}

export interface MemesDotFunPagination {
  total?: number;
  totalPages?: number;
  currentPage?: number;
  limit?: number;
}

export interface MemesDotFunCoinsResponse {
  message?: string;
  success?: boolean;
  data?: MemesDotFunCoin[];
  pagination?: MemesDotFunPagination;
}

export interface CodesResponse {
  data: CodeStore[];
  total_count: number;
}

export interface ContractDetails {
  contract_info?: Record<string, unknown>;
}

export interface CodeInfo {
  code_id?: string;
  creator?: string;
  instantiate_permission?: Record<string, unknown>;
}

export interface CodeDetails {
  code_info?: CodeInfo | null;
  contracts?: Record<string, unknown> | null;
}

export interface ValidatorDetails extends Validator {
  unbonding_height?: string;
  unbonding_time?: string;
  unbonding_on_hold_ref_count?: string;
  unbonding_ids?: string[];
}

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  decimals?: number;
  image_url?: string;
}

export interface TokenWithMetadata {
  denom?: string;
  amount?: string;
  metadata?: TokenMetadata;
}

export interface TokenBalance {
  factory?: TokenWithMetadata[] | null;
  cw20?: TokenWithMetadata[] | null;
  IBC?: TokenWithMetadata[] | null;
}

export interface AccountInfo {
  address?: string;
  pub_key?: Record<string, unknown>;
  account_number?: string;
  sequence?: string;
}

export interface RewardEntry {
  validator_address: string;
  reward: Array<{
    denom: string;
    amount: string;
  }>;
}

export interface ClaimableRewards {
  rewards: RewardEntry[];
  total: Array<{
    denom: string;
    amount: string;
  }>;
  total_zig?: string | null;
}

export interface AccountDetails {
  account_info?: AccountInfo | null;
  balance?: TokenBalance | null;
  claimable_rewards?: ClaimableRewards | null;
  total_transactions?: number | null;
  first_block_height?: number | null;
  account_creation_time?: string | null;
}

export interface LatestTxResponse {
  tx_hash: string;
  height: string | number;
  block_time: string;
  code: number;
  event_types: string | string[] | null;
  signer: string | null;
  recipient: string | null;
  amount: string | null;
  fee_amount: string | null;
  message_type: string | null;
  direction: 'sent' | 'received' | 'other';
}

export interface ContractTransactionsResponse {
  data: ContractTransaction[];
  total_count: number;
  limit?: number;
  offset?: number;
}

export interface AccountTransactionsResponse {
  data: AccountTransaction[];
  total_count: number;
  limit?: number;
  offset?: number;
}

export interface Delegation {
  delegator_address: string;
  validator_address: string;
  shares: string;
}

export interface DelegationBalance {
  denom: string;
  amount: string;
}

export interface DelegationResponse {
  delegation: Delegation;
  balance: DelegationBalance;
}

export interface DelegationPagination {
  next_key: string | null;
  total: string;
}

export interface DelegationList {
  delegation_responses: DelegationResponse[];
  pagination: DelegationPagination;
}

export interface ValdoraStaking {
  sender_wallet: string;
  total_stzig_deposited: string;
  total_uzig_deposited: string;
}

export interface ValdoraStakingTransaction {
  height: number;
  tx_hash: string;
  created_at: string;
  sender_address: string;
  stzig_amount_deposited: string;
  uzig_amount_deposited: string;
  action_method: string;
  transaction_status: number;
}
