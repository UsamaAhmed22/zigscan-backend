import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ApiRequestLog } from '../database/entities/api-request-log.entity';

export interface RequestLogPayload {
  apiKeyId?: string | null;
  apiKeyPrefix: string;
  ipAddress: string;
  method: string;
  path: string;
  statusCode: number;
  responseMs: number;
  bytesSent: number;
  userAgent?: string | null;
  referer?: string | null;
}

@Injectable()
export class RequestLoggingService {
  private readonly logger = new Logger(RequestLoggingService.name);

  constructor(
    @InjectRepository(ApiRequestLog)
    private readonly requestLogRepository: Repository<ApiRequestLog>,
  ) {}

  async logRequest(payload: RequestLogPayload): Promise<void> {
    const createdAt = new Date();
    const logEntry: Partial<ApiRequestLog> = {
      createdAt,
      requestId: randomUUID(),
      apiKeyId: payload.apiKeyId ?? null,
      apiKeyPrefix: payload.apiKeyPrefix,
      ipAddress: payload.ipAddress,
      method: payload.method,
      path: payload.path,
      statusCode: payload.statusCode,
      responseMs: payload.responseMs,
      bytesSent: payload.bytesSent,
      userAgent: payload.userAgent ?? null,
      referer: payload.referer ?? null,
    };

    try {
      await this.requestLogRepository.insert(logEntry);
    } catch (error) {
      // Do not block the request pipeline if logging fails.
      this.logger.warn(
        `Failed to persist request log for ${payload.method} ${payload.path}: ${
          error?.message ?? error
        }`,
      );
    }
  }
}
