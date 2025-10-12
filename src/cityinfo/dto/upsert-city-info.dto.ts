// Chemin : backend/src/cityinfo/dto/upsert-city-info.dto.ts

import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 🧑‍🤝‍🧑 STRUCTURE D'UN MEMBRE DE L'ÉQUIPE
 * Décrit comment doit être un membre (nom, rôle, photo)
 */
class TeamMemberDto {
  @IsString()
  name: string; // Obligatoire

  @IsString()
  @IsOptional()
  role?: string; // Optionnel (ex: "Adjoint au maire")

  @IsString()
  @IsOptional()
  photo?: string; // Optionnel (URL de la photo)
}

/**
 * 📰 STRUCTURE D'UNE ACTUALITÉ
 * Décrit comment doit être une actualité (titre, contenu, date, etc.)
 */
class NewsDto {
  @IsString()
  id: string; // ID unique de l'actualité

  @IsString()
  title: string; // Titre de l'actualité

  @IsString()
  content: string; // Contenu complet

  @IsString()
  date: string; // Date de publication

  @IsString()
  @IsOptional()
  icon?: string; // Emoji/icône (ex: 📰)

  @IsString()
  @IsOptional()
  color?: string; // Couleur de l'actualité (ex: #1E88E5)
}

/**
 * 📋 STRUCTURE D'UN SERVICE MUNICIPAL
 * Décrit comment doit être un service (titre, description, icône)
 */
class ServiceDto {
  @IsString()
  id: string; // ID unique du service

  @IsString()
  title: string; // Titre du service (ex: "État civil")

  @IsString()
  description: string; // Description du service

  @IsString()
  @IsOptional()
  icon?: string; // Emoji/icône (ex: 📋)
}

/**
 * 🏛️ STRUCTURE COMPLÈTE DES INFORMATIONS DE LA VILLE
 * C'est ce que la mairie peut envoyer quand elle remplit le formulaire
 */
export class UpsertCityInfoDto {
  // ========== OBLIGATOIRE ==========
  @IsString()
  cityName: string; // Le nom de la ville DOIT être fourni

  // ========== INFORMATIONS DU MAIRE (OPTIONNELLES) ==========
  @IsString()
  @IsOptional()
  mayorName?: string; // Nom du maire

  @IsString()
  @IsOptional()
  mayorPhone?: string; // Téléphone du maire

  @IsString()
  @IsOptional()
  mayorPhoto?: string; // Photo du maire (URL)

  // ========== INFORMATIONS DE LA MAIRIE (OPTIONNELLES) ==========
  @IsString()
  @IsOptional()
  address?: string; // Adresse complète de la mairie

  @IsString()
  @IsOptional()
  phone?: string; // Téléphone de la mairie

  @IsString()
  @IsOptional()
  hours?: string; // Horaires d'ouverture

  // ========== DONNÉES COMPLEXES (OPTIONNELLES) ==========
  
  // Liste des membres de l'équipe municipale
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true }) // Valider chaque élément du tableau
  @Type(() => TeamMemberDto) // Transformer en TeamMemberDto
  teamMembers?: TeamMemberDto[];

  // Liste des actualités
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NewsDto)
  news?: NewsDto[];

  // Liste des services municipaux
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ServiceDto)
  services?: ServiceDto[];
}