import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ContractsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by contract address' })
  @IsOptional()
  @IsString()
  contract_address?: string;

  @ApiPropertyOptional({ description: 'Filter by sender (legacy creator field)' })
  @IsOptional()
  @IsString()
  sender?: string;

  @ApiPropertyOptional({ description: 'Filter by code_id used to instantiate the contract' })
  @IsOptional()
  @IsString()
  code_id?: string;

  @ApiPropertyOptional({ description: 'Filter by contract creator address' })
  @IsOptional()
  @IsString()
  creator?: string;

  @ApiPropertyOptional({
    description: 'Filter contracts created on or after this ISO date/time',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  created_after?: string;

  @ApiPropertyOptional({
    description: 'Filter contracts created on or before this ISO date/time',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  created_before?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  height_min?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  height_max?: number;
}
