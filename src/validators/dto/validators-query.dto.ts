import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ValidatorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status: string = 'BOND_STATUS_BONDED';

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  offset = 0;
}
