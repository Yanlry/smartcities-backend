import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString() 
  date: string;

  @IsOptional()
  @IsString()
  location?: string;

  @Type(() => Number) 
  @IsNumber() 
  latitude: number;

  @Type(() => Number) 
  @IsNumber() 
  longitude: number;

  @Type(() => Number) 
  @IsNumber() 
  organizerId: number;

  @IsOptional()
  @Type(() => Number) 
  @IsNumber()
  reportId?: number;

  @IsOptional()
  @Type(() => Number) 
  @IsNumber()
  radius?: number;

  @IsOptional()
  photos?: Express.Multer.File[];
}