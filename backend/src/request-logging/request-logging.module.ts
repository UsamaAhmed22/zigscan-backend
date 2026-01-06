import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiRequestLog } from '../database/entities/api-request-log.entity';
import { RequestLoggingService } from './request-logging.service';
import { ApiRequestLoggingInterceptor } from './request-logging.interceptor';
import { ApiRequestLogPartitionService } from './request-log-partition.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiRequestLog])],
  providers: [
    RequestLoggingService,
    ApiRequestLogPartitionService,
    ApiRequestLoggingInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiRequestLoggingInterceptor,
    },
  ],
  exports: [RequestLoggingService],
})
export class RequestLoggingModule {}
