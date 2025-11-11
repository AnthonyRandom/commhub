import {
  IsNotEmpty,
  IsString,
  IsNumber,
  MaxLength,
  IsPositive,
  IsOptional,
  IsArray,
  ValidateIf,
} from 'class-validator';

export interface AttachmentData {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export class CreateMessageDto {
  @ValidateIf(o => !o.attachments || o.attachments.length === 0)
  @IsNotEmpty({
    message: 'Message content is required when no attachments are provided',
  })
  @IsString()
  @MaxLength(2000, {
    message: 'Message content must not exceed 2000 characters',
  })
  content?: string;

  @IsNotEmpty()
  @IsNumber({}, { message: 'Channel ID must be a valid number' })
  @IsPositive({ message: 'Channel ID must be a positive number' })
  channelId: number;

  @IsOptional()
  @IsNumber({}, { message: 'Reply To ID must be a valid number' })
  @IsPositive({ message: 'Reply To ID must be a positive number' })
  replyToId?: number;

  @IsOptional()
  @IsArray()
  attachments?: AttachmentData[];
}
