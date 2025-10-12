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
   * MÉTHODE 1 : Récupérer les infos d'une ville
   */
  async getCityInfo(cityName: string) {
    try {
      console.log('🏙️ Recherche des infos pour:', cityName);

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

      console.log('✅ Infos trouvées pour:', cityName);
      return cityInfo;
    } catch (error) {
      console.error('❌ Erreur getCityInfo:', error.message);
      throw error;
    }
  }

  /**
   * ✨ NOUVELLE MÉTHODE : Mettre à jour la photo du maire
   */
  async updateMayorPhoto(userId: number, cityName: string, photoUrl: string) {
    try {
      console.log('📸 Mise à jour photo du maire');
      console.log('👤 UserId:', userId);
      console.log('🏙️ Ville:', cityName);
      console.log('🖼️ URL photo:', photoUrl);

      // Vérifier que l'utilisateur est une mairie
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isMunicipality: true },
      });

      if (!user || !user.isMunicipality) {
        throw new ForbiddenException('Accès refusé. Seules les mairies peuvent modifier cette information.');
      }

      // Mettre à jour la photo dans la base de données
      const cityInfo = await this.prisma.cityInfo.upsert({
        where: {
          cityName: cityName.toUpperCase(),
        },
        update: {
          mayorPhoto: photoUrl,
        },
        create: {
          cityName: cityName.toUpperCase(),
          mayorPhoto: photoUrl,
        },
      });

      console.log('✅ Photo du maire mise à jour');
      return cityInfo;
    } catch (error) {
      console.error('❌ Erreur updateMayorPhoto:', error.message);
      throw error;
    }
  }

  /**
   * MÉTHODE 2 : Créer ou modifier les infos d'une ville
   */
  async upsertCityInfo(userId: number, data: UpsertCityInfoDto) {
    try {
      console.log('🏛️ Sauvegarde pour userId:', userId);

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

      console.log('✅ Utilisateur vérifié : c\'est bien une mairie');

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
          teamMembers: data.teamMembers as any,
          news: data.news as any,
          services: data.services as any,
        },
        create: {
          cityName: data.cityName.toUpperCase(),
          mayorName: data.mayorName,
          mayorPhone: data.mayorPhone,
          mayorPhoto: data.mayorPhoto,
          address: data.address,
          phone: data.phone,
          hours: data.hours,
          teamMembers: data.teamMembers as any,
          news: data.news as any,
          services: data.services as any,
        },
      });

      console.log('✅ Sauvegarde réussie pour:', data.cityName);
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
   * MÉTHODE 3 : Vérifier si une ville a déjà des infos
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
   * MÉTHODE 4 : Supprimer les infos d'une ville
   */
  async deleteCityInfo(cityName: string, userId: number) {
    try {
      console.log('🗑️ Suppression demandée pour:', cityName);

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

      console.log('✅ Infos supprimées pour:', cityName);
      return { message: 'Informations supprimées avec succès' };
    } catch (error) {
      console.error('❌ Erreur deleteCityInfo:', error.message);
      throw error;
    }
  }
}