import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClickhouseModule } from '../clickhouse/clickhouse.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ZigscanPostgresModule } from '../zigscan-postgres/zigscan-postgres.module';

@Module({
  imports: [AuthModule, DatabaseModule, BlockchainModule, ClickhouseModule, ZigscanPostgresModule],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
