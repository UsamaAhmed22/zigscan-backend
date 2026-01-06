import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { ZigscanPostgresService } from './zigscan-postgres.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [ZigscanPostgresService],
  exports: [ZigscanPostgresService],
})
export class ZigscanPostgresModule {}
