import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyAuthService } from '../api-key-auth.service';
import { ApiKeyContext } from '../interfaces/api-key-context.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: ApiKeyAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    type AuthenticatedRequest = Request & { authContext?: ApiKeyContext };
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authContext = request.authContext;

    if (!authContext) {
      throw new ForbiddenException('Authentication context missing');
    }

    this.authService.requireAdminAccess(authContext);
    return true;
  }
}
