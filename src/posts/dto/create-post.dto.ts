import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string; 

  @IsNumber()
  @IsNotEmpty()
  authorId: number; 

  @IsNumber()
  @IsOptional()
  latitude?: number; 

  @IsNumber()
  @IsOptional()
  longitude?: number; 

  @IsArray()
  @IsOptional()
  @IsString({ each: true }) 
  photoUrls?: string[]; 
}