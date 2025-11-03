import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class CreateDirectMessageDto {
  @IsNotEmpty()
  @IsNumber()
  receiverId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  content: string;
}
