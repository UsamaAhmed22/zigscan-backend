import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole } from '../../auth/enums/user-role.enum';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Role assigned to the generated API key',
    enum: [UserRole.ADMIN, UserRole.USER],
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Friendly label to identify the API key',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({
    description: 'Optional ISO8601 timestamp when the key expires',
    type: String,
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Deprecated: admin time window restriction is disabled and this flag is ignored',
  })
  @IsOptional()
  @IsBoolean()
  timeRestricted?: boolean;
}
