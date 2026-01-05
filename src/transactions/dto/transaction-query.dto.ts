import { IsInt, Min, IsOptional, Max, IsString, IsDateString } from 'class-validator';

export class GetTransactionsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  heightWindow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  beforeHeight?: number;
}
