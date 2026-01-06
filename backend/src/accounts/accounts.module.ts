import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ClickhouseModule } from '../clickhouse/clickhouse.module';
import { DatabaseModule } from '../database/database.module';
import { ZigscanPostgresModule } from '../zigscan-postgres/zigscan-postgres.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AuthModule, BlockchainModule, ClickhouseModule, DatabaseModule, ZigscanPostgresModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
