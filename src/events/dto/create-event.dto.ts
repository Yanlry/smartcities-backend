import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString() // Assure que la date est au format ISO-8601
  date: string;

  @IsOptional()
  @IsString()
  location?: string;

  @Type(() => Number) // Force la transformation en nombre
  @IsNumber() // Vérifie que c'est un nombre
  latitude: number;

  @Type(() => Number) // Force la transformation en nombre
  @IsNumber() // Vérifie que c'est un nombre
  longitude: number;

  @Type(() => Number) // Force la transformation en nombre
  @IsNumber() // Vérifie que c'est un nombre
  organizerId: number;

  @IsOptional()
  @Type(() => Number) // Force la transformation en nombre
  @IsNumber()
  reportId?: number;

  @IsOptional()
  @Type(() => Number) // Force la transformation en nombre
  @IsNumber()
  radius?: number;

  @IsOptional()
  photos?: Express.Multer.File[];
}