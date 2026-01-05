import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlocksModule } from '../blocks/blocks.module';
import { ValidatorsModule } from '../validators/validators.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { SupplyModule } from '../supply/supply.module';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';

@Module({
  imports: [AuthModule, BlocksModule, ValidatorsModule, TransactionsModule, SupplyModule],
  controllers: [NetworkController],
  providers: [NetworkService],
})
export class NetworkModule {}
