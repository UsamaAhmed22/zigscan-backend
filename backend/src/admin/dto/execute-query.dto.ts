import { IsNotEmpty, IsString } from 'class-validator';

export class AdminExecuteQueryDto {
  @IsString()
  @IsNotEmpty()
  sql!: string;
}
