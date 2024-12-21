import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string; // Le titre doit être une chaîne non vide

  @IsString()
  @IsNotEmpty()
  content: string; // Le contenu doit être une chaîne non vide

  @IsNumber()
  @IsNotEmpty()
  authorId: number; // L'auteur doit être un nombre
}