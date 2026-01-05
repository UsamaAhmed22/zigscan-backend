import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TvlController } from './tvl.controller';
import { TvlService } from './tvl.service';
import { TvlSnapshot } from '../database/entities/tvl-snapshot.entity';

@Module({
  imports: [ConfigModule, AuthModule, TypeOrmModule.forFeature([TvlSnapshot])],
  controllers: [TvlController],
  providers: [TvlService],
  exports: [TvlService],
})
export class TvlModule {}
