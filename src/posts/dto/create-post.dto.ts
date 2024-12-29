import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string; // Contenu de la publication

  @IsNumber()
  @IsNotEmpty()
  authorId: number; // ID de l'auteur de la publication

  @IsNumber()
  @IsOptional()
  latitude?: number; // Latitude (facultatif)

  @IsNumber()
  @IsOptional()
  longitude?: number; // Longitude (facultatif)
}