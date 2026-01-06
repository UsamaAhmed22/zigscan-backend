import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AccountTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter results by action type (supports SQL wildcard %)',
    example: '/%',
  })
  @IsOptional()
  @IsString()
  action_type?: string;
}
