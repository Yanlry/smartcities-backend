import { IsString, IsNotEmpty, IsInt } from 'class-validator';

export class CommentReportDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsInt()
  @IsNotEmpty()
  reportId: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;
}
