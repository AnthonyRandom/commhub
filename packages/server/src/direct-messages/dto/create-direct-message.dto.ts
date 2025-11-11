import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateDirectMessageDto {
  @IsNotEmpty()
  @IsNumber()
  receiverId: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}
