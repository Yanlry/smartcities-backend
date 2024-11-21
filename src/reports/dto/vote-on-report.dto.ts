import { IsNotEmpty, IsNumber, IsString, IsIn } from 'class-validator';

export class VoteOnReportDto {
  @IsNumber()
  @IsNotEmpty()
  reportId: number;

  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsIn(['up', 'down'], { message: 'Le type de vote doit être "up" ou "down".' })
  type: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
