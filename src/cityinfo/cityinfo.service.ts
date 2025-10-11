// Chemin : backend/src/cityinfo/cityinfo.service.ts

import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
  } from '@nestjs/common';
  import { PrismaService } from '../prisma/prisma.service';
  import { UpsertCityInfoDto } from './dto/upsert-city-info.dto';
  
  @Injectable()
  export class CityInfoService {
    constructor(private prisma: PrismaService) {}
  
    /**
     * Récupérer les informations d'une ville (PUBLIC)
     * @param cityName - Nom de la ville
     */
    async getCityInfo(cityName: string) {
      try {
        console.log('🏙️ Récupération des infos pour:', cityName);
  
        if (!cityName) {
          throw new BadRequestException('Le nom de la ville est requis');
        }
  
        const cityInfo = await this.prisma.cityInfo.findUnique({
          where: {
            cityName: cityName.toUpperCase(),
          },
        });
  
        if (!cityInfo) {
          throw new NotFoundException(
            'Cette ville n\'a pas encore configuré ses informations'
          );
        }
  
        console.log('✅ Informations trouvées pour:', cityName);
        return cityInfo;
      } catch (error) {
        console.error('❌ Erreur getCityInfo:', error.message);
        throw error;
      }
    }
  
    /**
     * Créer ou mettre à jour les informations d'une ville (PROTÉGÉ - MAIRIE)
     * @param userId - ID de l'utilisateur connecté
     * @param data - Données à sauvegarder
     */
    async upsertCityInfo(userId: number, data: UpsertCityInfoDto) {
      try {
        console.log('🏛️ Mise à jour des infos de la ville par userId:', userId);
  
        // 1. Vérifier que l'utilisateur existe et est une mairie
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isMunicipality: true,
            nomCommune: true,
          },
        });
  
        if (!user) {
          throw new NotFoundException('Utilisateur non trouvé');
        }
  
        if (!user.isMunicipality) {
          throw new ForbiddenException(
            'Accès refusé. Seules les mairies peuvent modifier ces informations.'
          );
        }
  
        console.log('✅ Utilisateur vérifié, c\'est une mairie');
  
        // 2. Créer ou mettre à jour les informations
        const cityInfo = await this.prisma.cityInfo.upsert({
          where: {
            cityName: data.cityName.toUpperCase(),
          },
          update: {
            mayorName: data.mayorName,
            mayorPhone: data.mayorPhone,
            mayorPhoto: data.mayorPhoto,
            address: data.address,
            phone: data.phone,
            hours: data.hours,
            teamMembers: data.teamMembers,
            news: data.news,
            services: data.services,
          },
          create: {
            cityName: data.cityName.toUpperCase(),
            mayorName: data.mayorName,
            mayorPhone: data.mayorPhone,
            mayorPhoto: data.mayorPhoto,
            address: data.address,
            phone: data.phone,
            hours: data.hours,
            teamMembers: data.teamMembers,
            news: data.news,
            services: data.services,
          },
        });
  
        console.log('✅ Informations sauvegardées avec succès pour:', data.cityName);
        return {
          message: 'Informations sauvegardées avec succès',
          data: cityInfo,
        };
      } catch (error) {
        console.error('❌ Erreur upsertCityInfo:', error.message);
        throw error;
      }
    }
  
    /**
     * Vérifier si une ville a configuré ses informations
     * @param cityName - Nom de la ville
     */
    async checkCityInfoExists(cityName: string): Promise<boolean> {
      try {
        const cityInfo = await this.prisma.cityInfo.findUnique({
          where: {
            cityName: cityName.toUpperCase(),
          },
        });
  
        return !!cityInfo;
      } catch (error) {
        console.error('❌ Erreur checkCityInfoExists:', error.message);
        return false;
      }
    }
  
    /**
     * Supprimer les informations d'une ville (ADMIN ONLY)
     * @param cityName - Nom de la ville
     * @param userId - ID de l'utilisateur qui fait la demande
     */
    async deleteCityInfo(cityName: string, userId: number) {
      try {
        console.log('🗑️ Suppression des infos pour:', cityName);
  
        // Vérifier que l'utilisateur est une mairie
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { isMunicipality: true },
        });
  
        if (!user || !user.isMunicipality) {
          throw new ForbiddenException('Accès refusé');
        }
  
        await this.prisma.cityInfo.delete({
          where: {
            cityName: cityName.toUpperCase(),
          },
        });
  
        console.log('✅ Informations supprimées pour:', cityName);
        return { message: 'Informations supprimées avec succès' };
      } catch (error) {
        console.error('❌ Erreur deleteCityInfo:', error.message);
        throw error;
      }
    }
  }