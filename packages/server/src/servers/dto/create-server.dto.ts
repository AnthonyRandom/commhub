import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateServerDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: 'Server name cannot be empty' })
  @MaxLength(100, { message: 'Server name must not exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Server description must not exceed 500 characters',
  })
  description?: string;
}
