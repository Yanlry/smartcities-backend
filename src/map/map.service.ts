import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MapService {
  constructor(private prisma: PrismaService) {}

  // RÉCUPÉRER TOUS LES SIGNALÉMENTS
  async getReports() {
    return await this.prisma.report.findMany();
  }

  // RÉCUPÉRER TOUS LES ÉVÉNEMENTS
  async getEvents() {
    return await this.prisma.event.findMany();
  }

  // FILTRER LES ÉLÉMENTS DE LA CARTE PAR TYPE (SIGNALÉMENT OU ÉVÉNEMENT)
  async filterMapItems(type: string) {
    if (type === 'report') {
      return await this.prisma.report.findMany(); 
    } else if (type === 'event') {
      return await this.prisma.event.findMany(); 
    } else {
      throw new Error('Invalid type'); 
    }
  }

  // RÉCUPÉRER LES SIGNALÉMENTS ET ÉVÉNEMENTS À PROXIMITÉ D'UNE POSITION
  async getNearbyItems(latitude: number, longitude: number, radius: number = 0.05) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    
    // Filtrer les signalements à proximité
    const nearbyReports = await this.prisma.report.findMany({
      where: {
        latitude: {
          gte: lat - radius, 
          lte: lat + radius, 
        },
        longitude: {
          gte: lon - radius, 
          lte: lon + radius,
        },
      },
    });

    // Filtrer les événements à proximité
    const nearbyEvents = await this.prisma.event.findMany({
      where: {
        latitude: {
          gte: lat - radius,
          lte: lat + radius,
        },
        longitude: {
          gte: lon - radius, 
          lte: lon + radius,
        },
      },
    });

    return { reports: nearbyReports, events: nearbyEvents };
  }

  // VERIFIER LA POSITION POUR LES INTERACTIONS (VOTE, COMMENTAIRE, etc.)
  async isUserWithinRadius(latitude: number, longitude: number, userLatitude: number, userLongitude: number, radius: number = 0.05): Promise<boolean> {
    const distance = this.calculateDistance(userLatitude, userLongitude, latitude, longitude);
    return distance <= radius;
  }

  // Calculer la distance entre deux points (en mètres)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Distance en mètres
    return distance;
  }

  // Conversion des degrés en radians
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
