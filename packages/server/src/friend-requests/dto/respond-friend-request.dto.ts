import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class RespondFriendRequestDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';
}
