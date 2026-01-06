import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyAuthService } from '../api-key-auth.service';
import { ApiKeyContext } from '../interfaces/api-key-context.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly authService: ApiKeyAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    type AuthenticatedRequest = Request & { authContext?: ApiKeyContext };
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers['authorization'] as string | undefined;

    const apiKey = this.authService.validateAuthorizationHeader(authorization);
    const authContext = await this.authService.validateApiKey(apiKey);

    request.authContext = authContext;
    this.enforceReadOnlyAccess(request);
    return true;
  }

  private enforceReadOnlyAccess(request: Request & { authContext?: ApiKeyContext }) {
    const method = (request.method || 'GET').toUpperCase();
    const isReadOnlyMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

    if (isReadOnlyMethod) {
      return;
    }

    try {
      this.authService.requireAdminAccess(request.authContext as ApiKeyContext);
    } catch (error) {
      const url = request.originalUrl || request.url || 'unknown';
      this.logger.warn(`Blocked ${method} ${url} for non-admin API key`);
      throw error;
    }
  }
}
