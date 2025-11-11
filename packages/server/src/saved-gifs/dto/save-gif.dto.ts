import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SaveGifDto {
  @IsNotEmpty()
  @IsString()
  gifUrl: string;

  @IsOptional()
  @IsString()
  tenorId?: string;

  @IsOptional()
  @IsString()
  contentDescription?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
