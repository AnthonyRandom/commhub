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
  @MaxLength(20, { message: 'Invite code must not exceed 20 characters' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Invite code can only contain uppercase letters and numbers',
  })
  inviteCode: string;
}
