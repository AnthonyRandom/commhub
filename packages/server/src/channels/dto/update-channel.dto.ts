import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'voice'])
  type?: string;
}
