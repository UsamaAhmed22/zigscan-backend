import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ContractsModule } from './contracts/contracts.module';
import { CodesModule } from './codes/codes.module';
import { ValidatorsModule } from './validators/validators.module';
import { AccountsModule } from './accounts/accounts.module';
import { AdminModule } from './admin/admin.module';
import { BlocksModule } from './blocks/blocks.module';
import { SupplyModule } from './supply/supply.module';
import { DefiModule } from './defi/defi.module';
import { NetworkModule } from './network/network.module';
import configuration from './config/configuration';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { TvlModule } from './tvl/tvl.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { SavedItemsModule } from './saved-items/saved-items.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { RequestLoggingModule } from './request-logging/request-logging.module';
import { MetricsModule } from './metrics/metrics.module';
import { MdfModule } from './mdf/mdf.module';
import { ZigscanPostgresModule } from './zigscan-postgres/zigscan-postgres.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
    }),

    // Rate Limiting - Prevents brute force attacks
    // NOTE: `ttl` is expressed in seconds in @nestjs/throttler, not milliseconds.
    // The previous value used 60000 (ms) which resulted in a very long window
    // (60,000 seconds ~ 16.7 hours) and effectively allowed only 10 requests
    // over that whole period. Use seconds (e.g. 60 => 60s = 1 minute).
    ThrottlerModule.forRoot([
      {
        ttl: 60, // Time window in seconds (60 seconds)
        limit: 10, // Maximum number of requests within the time window
      },
    ]),

    DatabaseModule,

    CacheModule.registerAsync({
      isGlobal: true, // <-- Makes cache available everywhere, no need to import in other modules
      imports: [ConfigModule], // <-- Import ConfigModule to use ConfigService
      inject: [ConfigService], // <-- Inject ConfigService
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,

        // Get your Redis connection details from your .env file
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),

        // Set a default TTL (Time To Live) in seconds
        ttl: 60, // Caches will expire after 60 seconds
      }),
    }),

    AuthModule,
    BlockchainModule,
    TransactionsModule,
    ContractsModule,
    CodesModule,
    ValidatorsModule,
    AccountsModule,
    AdminModule,
    BlocksModule,
    SupplyModule,
    DefiModule,
    NetworkModule,
    TvlModule,
    UsersModule,
    SavedItemsModule,
    ApiKeysModule,
    RequestLoggingModule,
    MetricsModule,
    MdfModule,
    ZigscanPostgresModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply rate limiting globally
    },
  ],
})
export class AppModule {}
