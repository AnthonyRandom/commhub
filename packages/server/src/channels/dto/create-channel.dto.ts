import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateChannelDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: 'Channel name cannot be empty' })
  @MaxLength(50, { message: 'Channel name must not exceed 50 characters' })
  @Matches(/^[^#@:]*$/, { message: 'Channel name cannot contain #, @, or :' })
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'voice'], {
    message: 'Channel type must be either text or voice',
  })
  type?: string = 'text';

  @IsNotEmpty()
  @IsNumber({}, { message: 'Server ID must be a valid number' })
  serverId: number;
}
