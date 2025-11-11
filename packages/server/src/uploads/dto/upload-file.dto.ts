import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class UploadFileDto {
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  channelId: number;
}
