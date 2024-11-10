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
  async getNearbyItems(latitude: number, longitude: number) {
    const radius = 0.05; 
  
    const lat = Number(latitude);
    const lon = Number(longitude);
  
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
}
