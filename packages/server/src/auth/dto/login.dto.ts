import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Transform(({ value }) => value?.toLowerCase())
  username: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;
}
