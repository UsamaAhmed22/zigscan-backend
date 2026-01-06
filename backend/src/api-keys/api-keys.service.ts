import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ApiKey } from '../database/entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UserRole } from '../auth/enums/user-role.enum';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly allowedIssuers: Set<string>;

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly configService: ConfigService,
  ) {
    this.allowedIssuers = this.parseAllowedIssuers();
  }

  async createApiKey(requestUserId: string, requestUserEmail: string, dto: CreateApiKeyDto) {
    this.ensureIssuerAllowed(requestUserEmail);

    if (![UserRole.ADMIN, UserRole.USER].includes(dto.role)) {
      throw new BadRequestException('Only admin or user API keys can be issued');
    }

    const apiKey = this.generateRawKey();
    const keyHash = this.hashKey(apiKey);

    const entity = this.apiKeyRepository.create({
      ownerId: requestUserId,
      keyHash,
      keyPrefix: apiKey.slice(0, 8),
      label: dto.label ?? null,
      role: dto.role,
      timeRestricted: typeof dto.timeRestricted === 'boolean' ? dto.timeRestricted : false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    await this.apiKeyRepository.save(entity);

    this.logger.log(
      `API key created by ${requestUserEmail} (role=${dto.role}, prefix=${entity.keyPrefix})`,
    );

    return {
      id: entity.id,
      apiKey,
      maskedKey: this.maskKey(apiKey),
      role: entity.role,
      label: entity.label,
      timeRestricted: entity.timeRestricted,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
    };
  }

  private ensureIssuerAllowed(email: string) {
    const normalized = email?.trim().toLowerCase();

    if (this.allowedIssuers.size === 0) {
      this.logger.error('API_KEY_ISSUER_EMAILS is not configured.');
      throw new ForbiddenException('API key issuance is disabled.');
    }

    if (!normalized || !this.allowedIssuers.has(normalized)) {
      throw new ForbiddenException('You are not allowed to generate API keys.');
    }
  }

  private parseAllowedIssuers(): Set<string> {
    const configured =
      this.configService.get<string>('API_KEY_ISSUER_EMAILS') ??
      this.configService.get<string>('API_KEY_ISSUER_EMAIL') ??
      '';

    const normalized = configured
      .split(/[,\s]+/)
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);

    return new Set(normalized);
  }

  private generateRawKey(): string {
    const random = crypto.randomBytes(32).toString('hex');
    return `zig_${random}`;
  }

  private hashKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private maskKey(apiKey: string): string {
    if (!apiKey) {
      return '***';
    }
    return apiKey.length > 8 ? `${apiKey.slice(0, 8)}...` : `${apiKey}***`;
  }
}
