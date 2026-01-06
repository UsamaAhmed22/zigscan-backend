import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyContext } from '../interfaces/api-key-context.interface';
import { Request } from 'express';

type AuthenticatedRequest = Request & { authContext?: ApiKeyContext };

export const AuthContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiKeyContext | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authContext;
  },
);

export const ApiKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authContext?.apiKey;
  },
);
