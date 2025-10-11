// Chemin : backend/src/cityinfo/dto/upsert-city-info.dto.ts

import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

/**
 * Ce fichier définit la structure des données que la mairie peut envoyer
 * C'est comme un formulaire qui dit "quels champs sont autorisés"
 */
export class UpsertCityInfoDto {
  // Le nom de la ville est OBLIGATOIRE
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la ville est requis' })
  cityName: string;

  // Tous les autres champs sont OPTIONNELS (la mairie peut les remplir ou non)
  @IsString()
  @IsOptional()
  mayorName?: string;

  @IsString()
  @IsOptional()
  mayorPhone?: string;

  @IsString()
  @IsOptional()
  mayorPhoto?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  hours?: string;

  // Ces champs peuvent contenir des objets complexes (équipe, actualités, services)
  @IsOptional()
  teamMembers?: any;

  @IsOptional()
  news?: any;

  @IsOptional()
  services?: any;
}