import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MapService {
  constructor(private prisma: PrismaService) {}

  async getReports() {
    return await this.prisma.report.findMany();
  }

  async getEvents() {
    return await this.prisma.event.findMany();
  }

  async filterMapItems(type: string) {
    if (type === 'report') {
      return await this.prisma.report.findMany(); 
    } else if (type === 'event') {
      return await this.prisma.event.findMany(); 
    } else {
      throw new Error('Invalid type'); 
    }
  }

  async getNearbyItems(latitude: number, longitude: number, radius: number = 0.05) {
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

  async isUserWithinRadius(latitude: number, longitude: number, userLatitude: number, userLongitude: number, radius: number = 0.05): Promise<boolean> {
    const distance = this.calculateDistance(userLatitude, userLongitude, latitude, longitude);
    return distance <= radius;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000;
    return distance;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
