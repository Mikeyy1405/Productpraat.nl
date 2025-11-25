import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ 
    description: 'Admin email adres',
    example: 'info@writgo.nl'
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Admin wachtwoord',
    example: 'Productpraat2025!'
  })
  @IsString()
  @MinLength(6)
  password: string;
}
