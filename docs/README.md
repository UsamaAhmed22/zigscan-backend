# ZigScan API - NestJS Backend (Read-Only)

TypeScript implementation of the ZigScan API, built with [NestJS](https://nestjs.com/). This service provides **read-only** REST endpoints for blockchain analytics, TVL data, transactions, contracts, and validator insights.

## 🏗️ Architecture

```
PostgreSQL  →  NestJS API  →  Clients
[tvl_data]     [Read-only]
```

### Key Principles
- ✅ **Read-Only Database Access** - No writes, migrations, or schema changes
- ✅ **Stateless API** - Pure data serving layer
- ✅ **CI/CD Ready** - Automated Docker deployments

## Features

- 📊 **TVL Data** - Historical and latest TVL from OroSwap and Valdora Staking
- 💸 **Transactions** - Statistics, filtering by action type and date range
- 📝 **Smart Contracts** - Contract and code store discovery with ClickHouse filters
- 👤 **Accounts** - Balances with token metadata and image fallbacks
- ✅ **Validators** - Validator listings enriched with Keybase metadata
- 🔐 **API Key Auth** - Role-based access with rate limiting
- 📈 **Message Types** - Transaction type statistics

## Prerequisites

- Node.js 18+
- npm (Node Package Manager)
- PostgreSQL database (with `tvl_data` table)
- ClickHouse access (for transaction queries)

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the project root and set the required values (see [Configuration](#configuration)). Example:

   ```bash
   cp .env.example .env  # create if needed
   ```

3. **Start the server**

   ```bash
   # Development (ts-node)
   npm run start:dev

   # Production build
   npm run build
   npm start
   ```

4. **Access the API**

   - Base URL: `http://localhost:8000`
   - Health check: `GET /api/v2/health`

## Scripts

| Command             | Description                               |
| ------------------- | ----------------------------------------- |
| `npm run start:dev` | Start NestJS with ts-node (hot reload)    |
| `npm run build`     | Compile TypeScript to `dist/`             |
| `npm start`         | Run the compiled app (`node dist/main`)   |

## Configuration

All configuration values are read from environment variables (case-insensitive, prefixed with `ZIGSCAN_`).

| Variable                      | Default                                                       | Description                                  |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| `ZIGSCAN_CLICKHOUSE_URL`      | `https://queries.clickhouse.cloud/service/.../run`            | ClickHouse HTTP endpoint                     |
| `ZIGSCAN_CLICKHOUSE_USERNAME` | `Ez6DiWTZWmxSWfTLYZ8d`                                        | ClickHouse username                          |
| `ZIGSCAN_CLICKHOUSE_PASSWORD` | `4b1dT3JW2OwlP1oOfopwINOV0rR1ct1NVYlIcWMayO`                  | ClickHouse password                          |
| `ZIGSCAN_CLICKHOUSE_DATABASE` | `zigchain_mainnet_database`                                   | ClickHouse database name                     |
| `ZIGSCAN_API_HOST`            | `0.0.0.0`                                                     | HTTP bind address                            |
| `ZIGSCAN_API_PORT`            | `8000`                                                        | HTTP port                                    |
| `ZIGSCAN_REQUIRE_AUTH`        | `true`                                                        | Require API key authentication               |
| `API_KEY_ISSUER_EMAILS`       | _(none)_                                                      | Emails allowed to issue API keys via API     |
| `ZIGSCAN_API`                 | `https://zigchain-mainnet-api.wickhub.cc`                     | Cosmos API base URL                          |
| `ZIGSCAN_RPC`                 | `https://zigchain-mainnet-rpc-sanatry-01.wickhub.cc`          | RPC base URL (currently unused)              |

> **Important:** When `ZIGSCAN_REQUIRE_AUTH=true`, at least one API key must exist in the `api_keys` table. You can provision keys through `POST /api/v2/api-keys`, which is restricted to the allow-listed `API_KEY_ISSUER_EMAILS`. Admin keys can optionally be time-restricted to the 9 AM – 5 PM window.

## CI/CD & Deployment

- **Workflow** – `.github/workflows/deploy.yml` builds the Docker image, pushes it to GitHub Container Registry, uploads `deploy/docker-compose.yml`, decodes the environment file from a base64 secret, and restarts the container on the target server. It runs on pushes to `main` or when manually triggered.
- **Server prerequisites** – Docker Engine 20.10+, `docker compose`, inbound SSH, and a writable deployment directory (e.g. `/opt/zigscan-api`).
- **Required GitHub secrets**
  - `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (PEM-formatted key with deploy permissions)
  - `SSH_PORT` (optional, defaults to `22`)
  - `SERVER_DEPLOY_PATH` (absolute path on the server where the files and containers live)
  - `ENV_FILE_B64` (base64-encoded contents of the `.env`; generate with `base64 --wrap=0 .env > env.b64`)
  - `GHCR_USERNAME`, `GHCR_TOKEN` (PAT with `read:packages` scope so the remote host can pull from GHCR)
- **Image reference** – The workflow pushes to `ghcr.io/<owner>/<repo>:latest` and `:sha`. The remote compose file reads the image tag from `IMAGE_NAME`, exported during deployment.
- **First-time setup** – After saving the secrets, trigger `Deploy ZigScan API` from the Actions tab or push to `main`. The job will create the target directory, copy `deploy/docker-compose.yml`, decode the `.env`, pull the image, and start the `zigscan-api` container bound to `127.0.0.1:${APP_PORT:-8000}` (localhost-only by default).

## Logging

- Application logs stream to stdout as usual and are also mirrored to `logs/zigscan-api.log`. The logger trims the file when the combined size would exceed 100 MB, keeping only the most recent chunk before appending new entries.

## Project Structure

- `src/app.module.ts` – Root module wiring all feature modules
- `src/api` – Core endpoints (health, stats, usage, custom query)
- `src/transactions` – Transaction statistics and detail lookups
- `src/contracts`, `src/codes` – Contract/code discovery endpoints
- `src/validators` – Validator listings and detail views (with Keybase integration)
- `src/accounts` – Account details and token metadata enrichment
- `src/admin` – Admin-only endpoints (user list, system stats, audit, SQL execution)
- `src/auth` – API key authentication, rate limiting, and guards
- `src/clickhouse` – HTTP client wrapper for ClickHouse queries
- `src/blockchain` – Axios clients for Cosmos API / RPC calls

## Authentication & Rate Limiting

- API keys are expected via `Authorization: Bearer <api-key>`
- Default rate limit: 100 requests per 60 seconds per key
- Usage statistics and admin enforcement mirror the previous FastAPI service

## 📚 Documentation

- **[API Reference](docs/API.md)** - Complete API endpoint documentation
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Postman Guide](docs/POSTMAN.md)** - API testing with Postman

## 📝 License

MIT
