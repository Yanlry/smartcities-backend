import { IsInt, IsNotEmpty } from 'class-validator';

export class JoinGroupDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
