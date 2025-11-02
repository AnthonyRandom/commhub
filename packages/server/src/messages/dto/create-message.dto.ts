import {
  IsNotEmpty,
  IsString,
  IsNumber,
  MaxLength,
  IsPositive,
} from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000, {
    message: 'Message content must not exceed 2000 characters',
  })
  content: string;

  @IsNotEmpty()
  @IsNumber({}, { message: 'Channel ID must be a valid number' })
  @IsPositive({ message: 'Channel ID must be a positive number' })
  channelId: number;
}
