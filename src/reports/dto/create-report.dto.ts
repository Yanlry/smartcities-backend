import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true }) 
  photoUrls?: string[]; 
}