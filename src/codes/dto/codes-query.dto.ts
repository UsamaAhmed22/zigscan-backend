import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CodesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sender?: string;

  @IsOptional()
  @IsString()
  code_id?: string;

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
