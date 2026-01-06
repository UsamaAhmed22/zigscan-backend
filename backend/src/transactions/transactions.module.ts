import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DatabaseModule } from '../database/database.module';
import { ClickhouseModule } from '../clickhouse/clickhouse.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ZigscanPostgresModule } from '../zigscan-postgres/zigscan-postgres.module';

@Module({
  imports: [AuthModule, DatabaseModule, BlockchainModule, ClickhouseModule, ZigscanPostgresModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
