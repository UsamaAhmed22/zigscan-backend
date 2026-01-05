import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ValidatorsController } from './validators.controller';
import { ValidatorsService } from './validators.service';
import { KeybaseService } from './keybase.service';

@Module({
  imports: [AuthModule, BlockchainModule],
  controllers: [ValidatorsController],
  providers: [ValidatorsService, KeybaseService],
  exports: [ValidatorsService],
})
export class ValidatorsModule {}
