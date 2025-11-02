import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsLowercase,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @Transform(({ value }) => value?.toLowerCase())
  @IsLowercase()
  username: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(254, { message: 'Email address is too long' })
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}
