import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DatabaseModule } from '../database/database.module';
import { ZigscanPostgresModule } from '../zigscan-postgres/zigscan-postgres.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [AuthModule, DatabaseModule, BlockchainModule, ZigscanPostgresModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
