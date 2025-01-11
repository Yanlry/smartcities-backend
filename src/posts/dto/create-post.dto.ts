import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray } from 'class-validator';

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

  @IsArray()
  @IsOptional()
  @IsString({ each: true }) // Chaque élément du tableau doit être une chaîne
  photoUrls?: string[]; // URLs des photos associées (facultatif)
}