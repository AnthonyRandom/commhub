import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateDirectMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  content: string;
}
