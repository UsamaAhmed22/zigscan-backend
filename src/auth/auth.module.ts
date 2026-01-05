import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyAuthService } from './api-key-auth.service';
import { ApiKey } from '../database/entities/api-key.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ApiKey])],
  providers: [ApiKeyAuthService],
  exports: [ApiKeyAuthService],
})
export class AuthModule {}
