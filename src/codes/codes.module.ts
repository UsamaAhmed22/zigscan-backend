import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DatabaseModule } from '../database/database.module';
import { ZigscanPostgresModule } from '../zigscan-postgres/zigscan-postgres.module';
import { CodesController } from './codes.controller';
import { CodesService } from './codes.service';

@Module({
  imports: [AuthModule, DatabaseModule, BlockchainModule, ZigscanPostgresModule],
  controllers: [CodesController],
  providers: [CodesService],
})
export class CodesModule {}
