import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class JoinServerDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Invite code must be at least 6 characters long' })
  @MaxLength(32, { message: 'Invite code must not exceed 32 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Invite code can only contain letters and numbers',
  })
  inviteCode: string;
}
