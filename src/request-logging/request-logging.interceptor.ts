import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RequestLoggingService } from './request-logging.service';
import { ApiKeyContext } from '../auth/interfaces/api-key-context.interface';
import { MetricsService } from '../metrics/metrics.service';

type LoggedRequest = Request & { authContext?: ApiKeyContext };

@Injectable()
export class ApiRequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly requestLoggingService: RequestLoggingService,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<LoggedRequest>();
    const response = httpCtx.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.persistLog(request, response, Date.now() - startedAt);
        },
        error: () => {
          this.persistLog(request, response, Date.now() - startedAt, true);
        },
      }),
    );
  }

  private persistLog(
    request: LoggedRequest,
    response: Response,
    durationMs: number,
    isError = false,
  ): void {
    const status = this.resolveStatusCode(response, isError);
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.connection.remoteAddress ||
      '';

    const authContext = request.authContext;
    const apiKeyPrefix = authContext?.apiKeyPrefix ?? 'public';
    const contentLength = response.getHeader('content-length');

    void this.requestLoggingService.logRequest({
      apiKeyId: authContext?.apiKeyId ?? null,
      apiKeyPrefix,
      ipAddress: ip,
      method: request.method ?? 'UNKNOWN',
      path: request.originalUrl ?? request.url ?? '',
      statusCode: status,
      responseMs: durationMs,
      bytesSent:
        typeof contentLength === 'string' ? Number(contentLength) : Number(contentLength) || 0,
      userAgent: this.safeHeader(request.headers['user-agent']),
      referer: this.safeHeader(request.headers['referer'] ?? request.headers['referrer']),
    });

    const pathLabel = this.extractPathLabel(request);
    this.metricsService.recordHttpRequest(
      request.method ?? 'UNKNOWN',
      pathLabel,
      status,
      durationMs,
    );
    this.metricsService.recordApiKeyRequest(apiKeyPrefix);
  }

  private resolveStatusCode(response: Response, isError: boolean): number {
    const status = response.statusCode ?? 500;
    if (isError && status < 400) {
      return 500;
    }
    return status;
  }

  private safeHeader(header?: string | string[]): string | null {
    if (!header) {
      return null;
    }
    return Array.isArray(header) ? header.join(', ') : header;
  }

  private extractPathLabel(request: LoggedRequest): string {
    if (request.route?.path) {
      return request.route.path;
    }
    const original = request.originalUrl ?? request.url ?? '';
    const [base] = original.split('?');
    return base;
  }
}
