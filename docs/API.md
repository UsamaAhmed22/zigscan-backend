# ZigScan API Endpoint Reference

This document lists every REST endpoint exposed by the ZigScan API along with authentication requirements, query parameters, and example payloads. The service is implemented with NestJS/Express and most endpoints proxy ClickHouse or Cosmos SDK data sources.

## Base URL & Authentication

- Default base URL: `http://localhost:8000`
- API version prefix: most endpoints live under `/api/v2`
- Authentication: supply a bearer token issued for your API key  
  `Authorization: Bearer <api-key>`
- Rate limiting: 100 requests per 60 s per key (enforced by `ApiKeyAuthService`)
- Admin endpoints require an API key with the `ADMIN` role; time-restricted keys are only honored between 09:00–17:00 server time.
- Responses are JSON. Unless otherwise noted, successful calls return HTTP `200 OK`; authentication failures return `401/403`, validation errors `400`, and upstream failures `5xx`.

```bash
curl -H "Authorization: Bearer ${ZIGSCAN_API_KEY}" \
     http://localhost:8000/api/v2/health
```

### Issuing API keys

- Authenticate with the regular user system (`/api/v2/auth/login`) to obtain a JWT.
- Only the emails listed in `API_KEY_ISSUER_EMAILS` may generate keys.
- POST `/api/v2/api-keys` with the desired `role` (`admin` or `user`) and optional metadata.

```bash
curl -X POST http://localhost:8000/api/v2/api-keys \
  -H "Authorization: Bearer ${JWT_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","label":"postman"}'
```

## Conventions

- Pagination parameters use `limit` and `offset`. Unless a DTO states otherwise, `limit` defaults to 50 and `offset` to 0.
- Date/time fields are returned as ISO 8601 strings.
- ClickHouse-backed lists return an object with `data` and `total_count`.

---

## Root Endpoint

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/` | none | Returns service metadata (name/version). |

```json
{
  "name": "ZIGScan API",
  "version": "1.0.0"
}
```

---

## Core Service (`/api/v2`)

### Health & General Stats

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/health` | none | Health check plus ClickHouse status. |
| GET | `/api/v2/stats` | API key | Aggregated chain stats (blocks, tx count). |

`GET /api/v2/health`

```json
{
  "status": "healthy",
  "service": "ZigScan API",
  "database": "ok",
  "database_error": null
}
```

`GET /api/v2/stats`

```json
{
  "total_blocks": 123456,
  "latest_height": 123456,
  "total_transactions": 789012
}
```

### Custom ClickHouse Query

| Method | Path | Query Params | Auth | Description |
| ------ | ---- | ------------ | ---- | ----------- |
| GET | `/api/v2/query` | `sql` (required),<br>`limit` (default 100, max 1000) | API key | Executes a read-only ClickHouse `SELECT` statement. A `LIMIT` is injected if absent. |

Errors:
- `400` if the query is not a `SELECT`
- `500` if ClickHouse returns an error

Example:

```bash
curl -G http://localhost:8000/api/v2/query \
  -H "Authorization: Bearer ${ZIGSCAN_API_KEY}" \
  --data-urlencode "sql=SELECT height, tx_hash FROM txs ORDER BY height DESC LIMIT 5"
```

```json
{
  "data": [
    { "height": 2885826, "tx_hash": "..." }
  ],
  "count": 5
}
```

---

## Transactions

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/transactions/latest` | API key | Latest transactions with action type and signer. Supports filtering by action type and date range. |
| GET | `/api/v2/transactions/stats` | API key | Aggregate transaction counts (7/15/30 days, TPS, hourly histogram). |
| GET | `/api/v2/transactions/message-types` | API key | Lists all message types with transaction counts, ordered by frequency. |
| GET | `/api/v2/transaction/:txHash` | API key | Fetches raw transaction data from the chain RPC. Returns 404 if not found. |

**Query parameters for `/transactions/latest`:**

| Name | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `limit` | integer (0–100) | 10 | Max records. |
| `offset` | integer (0–100) | 0 | Skip records. |
| `action` | string | none | Filter by action type (e.g., `/cosmos.bank.v1beta1.MsgSend`). Supports wildcards (`%`). |
| `startDate` | string (ISO 8601) | none | Start date for filtering (e.g., `2025-10-01T00:00:00`). |
| `endDate` | string (ISO 8601) | none | End date for filtering (e.g., `2025-10-15T00:00:00`). |
| `heightWindow` | integer (1–100000) | 1000 | Number of blocks to look back from the latest height (limits query scope). |
| `beforeHeight` | integer (>=1) | none | Height of the last transaction on the previous page; the next call returns entries strictly older than this height within the requested window (useful for paging back). |

Example response (latest):

```json
{
  "data": [
    {
      "height": 2885826,
      "tx_hash": "38E8...",
      "action_type": "/cosmos.bank.v1beta1.MsgSend",
      "status": 0,
      "signer": "zig1...",
      "created_at": "2025-10-10T14:04:46.591Z"
    }
  ],
  "total_count": 10
}
```

Example response (stats):

```json
{
  "tx_total": 1234567,
  "tx_last_30d": 43210,
  "tx_last_15d": 21000,
  "tx_last_7d": 10500,
  "tps_all_time": 2.31,
  "true_tps_all_time": 0.54,
  "hourly_txns": {
    "2025-05-01 12:00:00": 145,
    "2025-05-01 13:00:00": 132
  }
}
```

Example response (message-types):

```json
{
  "data": [
    {
      "transaction_type": "/cosmos.bank.v1beta1.MsgSend",
      "transaction_count": 125678
    },
    {
      "transaction_type": "/cosmos.staking.v1beta1.MsgDelegate",
      "transaction_count": 89234
    },
    {
      "transaction_type": "/cosmwasm.wasm.v1.MsgExecuteContract",
      "transaction_count": 45123
    },
    {
      "transaction_type": "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
      "transaction_count": 34567
    }
  ],
  "total_types": 42
}
```

`GET /api/v2/transaction/:txHash` mirrors the Cosmos `/cosmos/tx/v1beta1/txs/{txHash}` payload (minus `tx_response.tx` to reduce size).

---

## Blocks

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/blocks` | API key | Paginated block minting snapshots with validator rewards. |
| GET | `/api/v2/blocks/stats` | API key | Average/min block times, average tx count, daily block counts. |
| GET | `/api/v2/blocks/details/:height` | API key | Full block metadata pulled from the chain RPC. |
| GET | `/api/v2/blocks/transactions/:height` | API key | Transactions for a specific block. |

**Query parameters**

- `/blocks`: `limit` (1–1000, default 10), `offset` (default 0)
- `/blocks/stats`: `days` (1–365, default 30)

Example response (`/blocks`):

```json
{
  "data": [
    {
      "height": 2885826,
      "created_at": "2025-10-10T14:04:46.591Z",
      "txs_results_count": 12,
      "minter": "zigvaloper1...",
      "inflation": 0.15,
      "validator_rewards": [
        {
          "validator_address": "zigvaloper1...",
          "reward_amount": "12345uzig"
        }
      ]
    }
  ],
  "total_count": 10
}
```

Example response (`/blocks/stats`):

```json
{
  "avg_block_time_seconds": 6.1,
  "min_block_time_seconds": 4.2,
  "avg_txs_per_block": 9.8,
  "blocks_per_day": {
    "2025-04-30": 1432,
    "2025-05-01": 1440
  }
}
```

`/blocks/details/:height` returns the raw Tendermint block (`block`, `block_id`, `sdk_block`) from the ZigChain RPC.

---

## Contracts & Codes

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/contracts` | API key | Contract instantiations with filters. |
| GET | `/api/v2/contract/debug/:contractAddress` | API key | Raw instantiate event payloads for debugging. |
| GET | `/api/v2/contract/details/:contractAddress` | API key | Fetches on-chain contract metadata. |
| GET | `/api/v2/contract/transactions/:contractAddress` | API key | Contract executions involving the address (paginated). |
| GET | `/api/v2/codes` | API key | Code storage events with filters. |
| GET | `/api/v2/code/details/:codeId` | API key | Code info and associated contracts. |

**Shared pagination (`/contracts`, `/contract/transactions`, `/codes`):** `limit` (1–1000), `offset` (0+) default 50/0 via `PaginationQueryDto`.

**Additional filters:**

- `/contracts`:
  - `contract_address`, `sender`, `code_id` (strings)
  - `height_min`, `height_max` (ints ≥ 1; `height_min` ≤ `height_max`)
- `/codes`:
  - `sender`, `code_id`
  - `height_min`, `height_max`

Example response (`/contracts`):

```json
{
  "data": [
    {
      "height": 2879000,
      "tx_hash": "A1B2...",
      "created_at": "2025-10-08T11:22:33.000Z",
      "code_id": "47",
      "sender": "zig1...",
      "contract_address": "zig1contract..."
    }
  ],
  "total_count": 50
}
```

`/contract/debug/:contractAddress` returns:

```json
{
  "debug_data": [
    {
      "height": 2879000,
      "tx_hash": "A1B2...",
      "attrs_map": { "...": "..." },
      "available_keys": ["_contract_address", "sender", "code_id"]
    }
  ]
}
```

`/contract/details/:contractAddress` mirrors `/cosmwasm/wasm/v1/contract/{address}`.

`/contract/transactions/:contractAddress` returns `{ data: ContractTransaction[], total_count: number }` with the same schema as account transactions.

`/code/details/:codeId` combines:

```json
{
  "code_info": {
    "code_id": "47",
    "creator": "zig1...",
    "instantiate_permission": { "...": "..." }
  },
  "contracts": {
    "contracts": ["zig1...", "zig1..."],
    "pagination": { "next_key": null, "total": "2" }
  }
}
```

---

## Accounts

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/account/details/:address` | API key | Account info plus balances grouped by token type, plus transaction totals and creation metadata. |
| GET | `/api/v2/account/delegations/:address` | API key | Active delegations with total count and pagination cursor. |
| GET | `/api/v2/account/transactions/:address` | API key | Recent transactions where the address appears as sender/recipient/fee payer. |
| GET | `/api/v2/account/token-metadata` | API key | Metadata for native/factory/CW20/IBC tokens (symbol, decimals, icon, etc.). |
| GET | `/api/v2/accounts/total` | API key | Total number of accounts (via Cosmos pagination metadata). |

Notes:
- `:address` must start with `zig1`; contract (`zig1` + > 50 chars) or `zigvaloper` addresses are rejected with `400`.
- Balances group tokens into `factory`, `cw20`, and `IBC`. Metadata includes `symbol`, `decimals`, and `image_url`.
- `/account/delegations` returns `{ delegation_responses: DelegationResponse[], pagination: { next_key, total } }`; empty delegations yield an empty array with total `0`.
- `/account/transactions` enforces pagination and clamps `limit` to 1–1000.

**Query parameters for `/account/transactions/:address`:**

| Name | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `limit` | integer (1–1000) | 50 | Maximum records per page. |
| `offset` | integer (0+) | 0 | Number of records to skip. |

Example (`/account/details`):

```json
{
  "account_info": {
    "address": "zig1abcd...",
    "account_number": "12345",
    "sequence": "7",
    "pub_key": { "type_url": "...", "value": "..." }
  },
  "balance": {
    "factory": [
      {
        "denom": "uzig",
        "amount": "123456789",
        "metadata": {
          "name": "ZIG",
          "symbol": "ZIG",
          "decimals": 6,
          "image_url": "https://..."
        }
      }
    ],
    "cw20": null,
    "IBC": null
  },
  "total_transactions": 123,
  "first_block_height": 123456,
  "account_creation_time": "2025-10-01T12:34:56.000Z"
}
```

`/account/token-metadata` accepts a `denom` query parameter and returns the resolved metadata:

```
GET /api/v2/account/token-metadata?denom=coin.zig109f7g2rzl2aqee7z6gffn8kfe9cpqx0mjkk7ethmx8m2hq4xpe9snmaam2.stzig
```

```json
{
  "denom": "coin.zig109f7g2rzl2aqee7z6gffn8kfe9cpqx0mjkk7ethmx8m2hq4xpe9snmaam2.stzig",
  "metadata": {
    "name": "STZIG",
    "symbol": "STZIG",
    "description": "Factory token: STZIG",
    "decimals": 6,
    "image_url": "https://raw.githubusercontent.com/..."
  }
}
```

`total_transactions` counts every row in `public_address_transactions` for the address, `first_block_height` is the earliest height in that table, and `account_creation_time` is the corresponding block time (all sourced from ClickHouse).

`/accounts/total`:

```json
{ "total": 98765 }
```

`/account/delegations` mirrors the Cosmos staking delegation response and always includes a `pagination` object. `/account/transactions` returns `{ data: AccountTransaction[], total_count: number }` sorted by height DESC.

---

## Validators

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/validators` | API key | Lists validators (default bonded). Enriches with Keybase avatar. |
| GET | `/api/v2/validator/details/:validatorAddress` | API key | Fetch single validator; returns 404 if not found. |

Query parameters:

| Name | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `status` | string | `BOND_STATUS_BONDED` | Any Cosmos staking status. |
| `limit` | integer (1–1000) | 50 | |
| `offset` | integer (0+) | 0 | |

Example list response:

```json
{
  "data": [
    {
      "operator_address": "zigvaloper1...",
      "description": { "moniker": "Validator 1", "identity": "12345" },
      "commission": { "commission_rates": { "rate": "0.050000000000000000" } },
      "status": "BOND_STATUS_BONDED",
      "tokens": "1234567890",
      "delegator_shares": "1234567890.000000000000000000",
      "jailed": false,
      "consensus_pubkey": { "@type": "...", "key": "..." },
      "min_self_delegation": "1",
      "keybase_image_url": "https://keybase.io/..."
    }
  ],
  "total_count": 50
}
```

---

## Supply & Market Data

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/supply` | API key | On-chain supply plus derived circulating/non-circulating. |
| GET | `/api/v2/zig/market-data` | API key | Current price/volume metrics from CoinGecko. |
| GET | `/api/v2/zig/staking-pool` | API key | Bonded vs non-bonded staking pool balances. |
| GET | `/api/v2/zig/price-data` | API key | Historical price/volume chart data. |

`/zig/price-data` query parameter:

| Name | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `days` | string | `24hr` | Passed directly to CoinGecko (e.g. `7`, `30`, `90`, `1`, `7d`). |

Example (`/supply`):

```json
{
  "denom": "uzig",
  "amountMicro": "987654321000000",
  "amount": "987654.321",
  "circulatingSupply": 912345.67,
  "nonCirculatingSupply": 75308.651
}
```

Example (`/zig/market-data`):

```json
{
  "name": "ZigChain",
  "symbol": "ZIG",
  "current_price": 0.12,
  "price_change_24h": 0.005,
  "price_change_7d": 0.02,
  "price_change_30d": -0.01,
  "price_change_90d": 0.11,
  "circulating_supply": 912345.67,
  "nonCirculatingSupply": 75308.651,
  "total_supply": 987654.321,
  "max_supply": null,
  "market_cap": 109481.48,
  "total_volume": 5321.77,
  "image": "https://assets.coingecko.com/.../zig.png"
}
```

`/zig/price-data` returns CoinGecko chart arrays:

```json
{
  "prices": [[1714543200000, 0.12], [1714546800000, 0.118]],
  "market_caps": [[1714543200000, 105000]],
  "total_volumes": [[1714543200000, 3200]]
}
```

Example (`/zig/staking-pool`):

```json
{
  "bondedTokensMicro": "123456789000000",
  "bondedTokens": "123456.789",
  "notBondedTokensMicro": "98765432100000",
  "notBondedTokens": "98.765432"
}
```

---

## DeFi (Degenter Proxy)

All DeFi endpoints proxy `DEGENTER_API` responses. Authentication still uses ZigScan API keys.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v2/tokens` | API key | Lists Degenter tokens. Supports sorting. |
| GET | `/api/v2/tokens/details/:denom` | API key | Token profile, social links, and metrics. |
| GET | `/api/v2/tokens/:denom/pools` | API key | Pools for a token. |
| GET | `/api/v2/tokens/:denom/holders` | API key | Token holders list. |
| GET | `/api/v2/tokens/:denom/ohlcv` | API key | OHLCV candles (default timeframe set by Degenter). |
| GET | `/api/v2/pools/:poolId/trades` | API key | Trades for a pool. |

Query parameters:

- `/tokens`: `limit`, `offset`, `sort`, `dir`
- `/tokens/:denom/holders`: `limit`, `offset`
- `/pools/:poolId/trades`: `limit` (default 50), `offset` (default 0), `unit` (`usd` by default), `tf` (`24h` by default)
- `/tokens/:denom/ohlcv`: no additional query params; interval configured server-side.

Sample (`/tokens`):

```json
{
  "success": true,
  "data": [
    {
      "tokenId": "123",
      "denom": "coin.xyz",
      "symbol": "XYZ",
      "name": "XYZ Token",
      "imageUri": "https://...",
      "createdAt": "2024-11-01T00:00:00.000Z",
      "priceNative": 1.23,
      "priceUsd": 0.12,
      "mcapUsd": 500000,
      "holders": 1234,
      "volUsd": 23000,
      "tx": 450
    }
  ],
  "meta": {
    "limit": 25,
    "offset": 0,
    "total": 142
  }
}
```

`/tokens/details/:denom` returns the Degenter token profile (`success`, `data` with metadata, liquidity, price change buckets).

`/tokens/:denom/ohlcv` response:

```json
{
  "success": true,
  "data": [
    { "ts_sec": 1714543200, "open": 0.12, "high": 0.125, "low": 0.118, "close": 0.123, "volume": 5321.7 }
  ],
  "meta": { "tf": "5m", "unit": "usd", "priceSource": "degenter" }
}
```

`/pools/:poolId/trades` response:

```json
{
  "success": true,
  "data": [
    {
      "time": "2025-05-01T12:34:56Z",
      "txHash": "ABC123...",
      "pairContract": "zig1pool...",
      "signer": "zig1...",
      "direction": "buy",
      "offerDenom": "uzig",
      "offerAmount": 100,
      "askDenom": "coin.xyz",
      "returnAmount": 2500,
      "priceUsd": 0.12,
      "valueUsd": 12.5
    }
  ],
  "meta": { "limit": 50, "offset": 0, "unit": "usd", "tf": "24h", "total": 1000 }
}
```

---

## Admin (`/api/v2/admin`)

All endpoints are protected by both `ApiKeyGuard` and `AdminGuard`, requiring an admin API key.

| Method | Path | Query Params | Description |
| ------ | ---- | ------------ | ----------- |
| GET | `/api/v2/admin/users` | — | Lists masked API keys, roles, request counts, and window status. |
| GET | `/api/v2/admin/system-stats` | — | Global auth/rate limit statistics. |
| POST | `/api/v2/admin/execute-query` | `sql` (required) | Executes arbitrary ClickHouse SQL. Returns `success`, `data`, `count`, and `executed_by`. |
| GET | `/api/v2/admin/audit-log` | `limit` (1–1000, default 100) | Returns recent API key usage snapshots. |

Example (`POST /admin/execute-query`):

```bash
curl -X POST http://localhost:8000/api/v2/admin/execute-query \
  -H "Authorization: Bearer ${ADMIN_API_KEY}" \
  --data-urlencode "sql=SELECT count() AS tx_total FROM txs"
```

Response:

```json
{
  "success": true,
  "data": [{ "tx_total": 1234567 }],
  "count": 1,
  "executed_by": "abcd1234..."
}
```

---

## Error Handling Reference

- `400 Bad Request` – validation failures (e.g., invalid address format, `height_min > height_max`, non-SELECT query).
- `401 Unauthorized` – missing/invalid bearer token.
- `403 Forbidden` – admin guard rejection or admin window inactive.
- `404 Not Found` – missing on-chain resources (transactions, validators).
- `502/504` – upstream APIs (Cosmos, CoinGecko, Degenter) not reachable.

When proxied services return errors, the ZigScan API wraps them as `{ "error": "message" }` with the relevant HTTP status.

---

## Testing & Tooling

- Use the included `rest-client.http` or Postman collection (`POSTMAN_GUIDE.md`) for manual exploration.
- For ClickHouse-heavy workflows, prefer scoped `SELECT` queries with explicit `LIMIT`s to minimize response sizes.
