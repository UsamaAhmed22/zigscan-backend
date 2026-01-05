import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AppConfiguration } from '../config/configuration';
import { UserRole } from './enums/user-role.enum';
import { ApiKeyContext, UserRoleInfo } from './interfaces/api-key-context.interface';
import { ApiKey } from '../database/entities/api-key.entity';

interface RateLimitInfo {
  requestsInWindow: number;
  maxRequests: number;
  windowSeconds: number;
  remaining: number;
}

@Injectable()
export class ApiKeyAuthService {
  private readonly logger = new Logger(ApiKeyAuthService.name);
  private readonly usageStats = new Map<string, number>();
  private readonly rateLimiter = new Map<string, number[]>();
  private readonly requireAuth: boolean;

  private readonly maxRequests = 100;
  private readonly windowSeconds = 60;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {
    const apiConfig = this.configService.getOrThrow<AppConfiguration['api']>('api');
    this.requireAuth = apiConfig.requireAuth ?? true;

    this.logger.log('API authentication initialized (database-backed keys)');
  }

  validateAuthorizationHeader(header?: string): string {
    if (!this.requireAuth) {
      return '';
    }

    if (!header) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [scheme, token] = header.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(
        'Invalid authorization header format. Expected Bearer token.',
      );
    }

    return token;
  }

  async validateApiKey(apiKey: string): Promise<ApiKeyContext> {
    if (!this.requireAuth) {
      return {
        apiKey: '',
        maskedKey: 'public',
        role: UserRole.READONLY,
        permissions: ['read'],
        timeRestricted: false,
        apiKeyId: undefined,
        apiKeyPrefix: 'public',
      };
    }

    const maskedKey = this.maskKey(apiKey);
    this.logger.log(`Checking API key ${maskedKey}`);

    const keyHash = this.hashKey(apiKey);
    const keyRecord = await this.apiKeyRepository.findOne({
      where: { keyHash, isActive: true },
    });

    if (!keyRecord) {
      this.logger.warn(`Authentication failed: invalid API key ${maskedKey}`);
      throw new UnauthorizedException('Invalid API key');
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt.getTime() < Date.now()) {
      this.logger.warn(`Authentication failed: expired API key ${maskedKey}`);
      throw new UnauthorizedException('API key expired');
    }

    const userInfo = this.getRoleInfo(keyRecord);
    if (userInfo.role !== UserRole.ADMIN) {
      this.applyRateLimit(apiKey);
    }

    await this.incrementUsage(apiKey, keyRecord);

    return {
      apiKey,
      maskedKey,
      role: userInfo.role,
      permissions: userInfo.permissions,
      timeRestricted: userInfo.timeRestricted,
      apiKeyId: keyRecord.id,
      apiKeyPrefix: keyRecord.keyPrefix,
    };
  }

  requireAdminAccess(authContext: ApiKeyContext): void {
    if (!this.requireAuth) {
      return;
    }

    if (!authContext || authContext.role !== UserRole.ADMIN) {
      const keyForLog = authContext?.apiKey ? this.maskKey(authContext.apiKey) : 'unknown';
      this.logger.warn(`Admin access denied: API key ${keyForLog} is not admin`);
      throw new ForbiddenException('Admin access required.');
    }

    this.logger.log(`Admin access granted for ${this.maskKey(authContext.apiKey)}`);
  }

  async getApiKeyStats(apiKey: string) {
    const keyHash = this.hashKey(apiKey);
    const record = await this.apiKeyRepository.findOne({ where: { keyHash } });

    if (!record) {
      return { error: 'Invalid API key' };
    }

    const roleInfo = this.getRoleInfo(record);
    const rateInfo = this.getRateLimitInfo(apiKey);

    return {
      api_key: this.maskKey(apiKey),
      role: roleInfo.role,
      permissions: roleInfo.permissions,
      time_restricted: roleInfo.timeRestricted,
      admin_window_active: false,
      total_requests: Number(record.requestCount ?? 0),
      rate_limit: rateInfo,
      is_active: record.isActive,
    };
  }

  async listUsers() {
    const records = await this.apiKeyRepository.find({ order: { createdAt: 'ASC' } });

    return records.map(record => {
      const info = this.getRoleInfo(record);
      return {
        api_key: `${record.keyPrefix}...`,
        role: info.role,
        permissions: info.permissions,
        time_restricted: info.timeRestricted,
        total_requests: Number(record.requestCount ?? 0),
        last_used_at: record.lastUsedAt,
        expires_at: record.expiresAt,
        is_active: record.isActive,
      };
    });
  }

  async getSystemStats() {
    const records = await this.apiKeyRepository.find();

    const totalRequests = records.reduce(
      (sum, record) => sum + Number(record.requestCount ?? 0),
      0,
    );
    const activeKeys = records.filter(record => record.isActive).length;
    const adminUsers = records.filter(record => record.role === UserRole.ADMIN).length;
    const regularUsers = records.filter(record => record.role === UserRole.USER).length;

    return {
      total_api_keys: records.length,
      active_api_keys: activeKeys,
      total_requests: totalRequests,
      admin_users: adminUsers,
      regular_users: regularUsers,
      admin_time_window: null,
    };
  }

  async getAuditLog(limit: number) {
    const [entries, totalEntries] = await Promise.all([
      this.apiKeyRepository.find({
        where: { requestCount: MoreThan('0') },
        order: { requestCount: 'DESC' },
        take: limit,
      }),
      this.apiKeyRepository.count({ where: { requestCount: MoreThan('0') } }),
    ]);

    return {
      audit_entries: entries.map(record => ({
        api_key: `${record.keyPrefix}...`,
        role: record.role,
        total_requests: Number(record.requestCount ?? 0),
        last_used_at: record.lastUsedAt,
      })),
      total_entries: totalEntries,
    };
  }

  private applyRateLimit(apiKey: string): void {
    const now = Date.now();
    const windowStart = now - this.windowSeconds * 1000;
    const timestamps = this.rateLimiter.get(apiKey) ?? [];
    const recent = timestamps.filter(timestamp => timestamp >= windowStart);

    if (recent.length >= this.maxRequests) {
      const rateInfo = this.getRateLimitInfo(apiKey, recent);
      this.logger.warn(
        `Rate limit exceeded for ${this.maskKey(apiKey)} (${rateInfo.requestsInWindow}/${rateInfo.maxRequests})`,
      );
      throw new HttpException(
        `Rate limit exceeded. Max ${rateInfo.maxRequests} requests per ${rateInfo.windowSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.rateLimiter.set(apiKey, recent);
  }

  private async incrementUsage(apiKey: string, record: ApiKey): Promise<void> {
    const current = this.usageStats.get(apiKey) ?? 0;
    this.usageStats.set(apiKey, current + 1);
    const rateInfo = this.getRateLimitInfo(apiKey);
    await this.apiKeyRepository.increment({ id: record.id }, 'requestCount', 1);
    await this.apiKeyRepository.update(record.id, { lastUsedAt: new Date() });

    const userInfo = this.getRoleInfo(record);
    this.logger.log(
      `API key authenticated: ${this.maskKey(apiKey)} (role: ${
        userInfo?.role ?? 'unknown'
      }, total: ${current + 1}, window: ${rateInfo.requestsInWindow}/${rateInfo.maxRequests})`,
    );
  }

  private getRateLimitInfo(apiKey: string, timestamps?: number[]): RateLimitInfo {
    const windowStart = Date.now() - this.windowSeconds * 1000;
    const entries = timestamps ?? this.rateLimiter.get(apiKey) ?? [];
    const clean = entries.filter(timestamp => timestamp >= windowStart);
    if (!timestamps) {
      this.rateLimiter.set(apiKey, clean);
    }

    return {
      requestsInWindow: clean.length,
      maxRequests: this.maxRequests,
      windowSeconds: this.windowSeconds,
      remaining: Math.max(0, this.maxRequests - clean.length),
    };
  }

  private maskKey(apiKey: string): string {
    if (!apiKey) {
      return '***';
    }
    return apiKey.length > 8 ? `${apiKey.slice(0, 8)}...` : `${apiKey}***`;
  }

  private hashKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private getRoleInfo(record: ApiKey): UserRoleInfo {
    const info: UserRoleInfo = {
      role: record.role,
      permissions: record.role === UserRole.ADMIN ? ['read', 'write', 'admin', 'query'] : ['read'],
      // Time window restrictions are disabled for admin access.
      timeRestricted: false,
    };
    return info;
  }
}
