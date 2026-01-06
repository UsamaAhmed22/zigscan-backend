import 'express-serve-static-core';
import { ApiKeyContext } from '../auth/interfaces/api-key-context.interface';

declare module 'express-serve-static-core' {
  interface Request {
    authContext?: ApiKeyContext;
  }
}
