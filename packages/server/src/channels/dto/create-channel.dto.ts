import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateChannelDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'voice'])
  type?: string = 'text';

  @IsNotEmpty()
  serverId: number;
}
