const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

export interface AppConfiguration {
  clickhouse: {
    url: string;
    username: string;
    password: string;
    database: string;
  };
  postgres: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  zigscanPostgres: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  defi: {
    apiBaseUrl: string;
  };
  api: {
    host: string;
    port: number;
    reload: boolean;
    requireAuth: boolean;
  };
  blockchain: {
    apiBaseUrl: string;
    rpcBaseUrl: string;
  };
  memesfun: {
    apiBaseUrl: string;
    apiKey: string;
  };
}

export default (): AppConfiguration => ({
  clickhouse: {
    url:
      process.env.ZIGSCAN_CLICKHOUSE_URL ??
      'https://queries.clickhouse.cloud/service/3d33b0ea-1986-48b3-8c9f-0db38c1a0a62/run',
    username: process.env.ZIGSCAN_CLICKHOUSE_USERNAME ?? 'Ez6DiWTZWmxSWfTLYZ8d',
    password:
      process.env.ZIGSCAN_CLICKHOUSE_PASSWORD ?? '4b1dT3JW2OwlP1oOfopwINOV0rR1ct1NVYlIcWMayO',
    database: process.env.ZIGSCAN_CLICKHOUSE_DATABASE ?? 'zigchain_mainnet_database',
  },
  postgres: {
    host: process.env.POSTGRES_BACKUP_HOST ?? process.env.POSTGRES_HOST ?? 'localhost',
    port: parseNumber(process.env.POSTGRES_BACKUP_PORT ?? process.env.POSTGRES_PORT, 5432),
    username: process.env.POSTGRES_BACKUP_USER ?? process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_BACKUP_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_BACKUP_DB ?? 'zigchain_mainnet_backup',
    ssl: parseBoolean(process.env.POSTGRES_BACKUP_SSL ?? process.env.POSTGRES_SSL, false),
  },
  zigscanPostgres: {
    host: process.env.ZIGSCAN_POSTGRES_HOST ?? '127.0.0.1',
    port: parseNumber(process.env.ZIGSCAN_POSTGRES_PORT, 5433),
    username: process.env.ZIGSCAN_POSTGRES_USER ?? 'postgres',
    password: process.env.ZIGSCAN_POSTGRES_PASSWORD ?? '',
    database: process.env.ZIGSCAN_POSTGRES_DATABASE ?? 'zigscan_mainnet',
    ssl: parseBoolean(process.env.ZIGSCAN_POSTGRES_SSL, false),
  },
  defi: {
    apiBaseUrl: process.env.DEGENTER_API ?? 'https://dev-api.degenter.io',
  },
  api: {
    host: process.env.ZIGSCAN_API_HOST ?? '0.0.0.0',
    port: parseNumber(process.env.ZIGSCAN_API_PORT, 8000),
    reload: parseBoolean(process.env.ZIGSCAN_API_RELOAD, false),
    requireAuth: parseBoolean(process.env.ZIGSCAN_REQUIRE_AUTH, true),
  },
  blockchain: {
    apiBaseUrl: process.env.ZIGSCAN_API ?? 'https://zigchain-mainnet-api.wickhub.cc',
    rpcBaseUrl: process.env.ZIGSCAN_RPC ?? 'https://zigchain-mainnet-rpc-sanatry-01.wickhub.cc',
  },
  memesfun: {
    apiBaseUrl: process.env.MEMES_FUN_API_BASE_URL ?? 'https://memes.fun/api/partner/v1/zigscan',
    apiKey: process.env.MEMES_FUN_API_KEY ?? '',
  },
});
