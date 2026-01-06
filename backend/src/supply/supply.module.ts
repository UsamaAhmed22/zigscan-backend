import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { SupplyController } from './supply.controller';
import { ZigSupplyService } from './supply.service';

@Module({
  imports: [ConfigModule, AuthModule, BlockchainModule],
  controllers: [SupplyController],
  providers: [ZigSupplyService],
  exports: [ZigSupplyService],
})
export class SupplyModule {}
