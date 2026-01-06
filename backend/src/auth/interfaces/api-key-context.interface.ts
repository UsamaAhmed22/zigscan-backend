import { UserRole } from '../enums/user-role.enum';

export interface ApiKeyContext {
  apiKey: string;
  maskedKey: string;
  role: UserRole;
  permissions: string[];
  timeRestricted: boolean;
  apiKeyId?: string;
  apiKeyPrefix?: string;
}

export interface UserRoleInfo {
  role: UserRole;
  permissions: string[];
  timeRestricted: boolean;
}
