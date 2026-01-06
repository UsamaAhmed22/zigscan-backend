import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username or email address',
    example: 'john_doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Username or email is required' })
  identifier: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
