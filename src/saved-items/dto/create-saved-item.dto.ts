import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSavedItemDto {
  @ApiProperty({
    description: 'The identifier of the item to save (address, tx hash, protocol name, etc.)',
    example: 'zig1abc123...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Item identifier is required' })
  @MaxLength(500, { message: 'Item identifier must not exceed 500 characters' })
  itemSaved: string;

  @ApiPropertyOptional({
    description: 'Type of item (protocol, token, contract, transaction, address, etc.)',
    example: 'contract',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Item type must not exceed 50 characters' })
  itemType?: string;
}
