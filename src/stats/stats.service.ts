import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Récupérer les statistiques personnelles de l'utilisateur
  async getUserStats(userId: number) {
    const userIdAsNumber = parseInt(userId.toString(), 10);

    if (isNaN(userIdAsNumber)) {
      throw new Error("L'ID de l'utilisateur est invalide");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userIdAsNumber },
      include: {
        reports: true,
        votes: true,
        comments: true,
      },
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    return {
      totalReports: user.reports.length,
      totalVotes: user.votes.length,
      totalComments: user.comments.length,
    };
  }

  // Récupérer les signalements par type
  async getReportsByType(type: string) {
    const reportsByType = await this.prisma.report.findMany({
      where: {
        type: type,
      },
    });
    return reportsByType; 
  }

  // Récupérer les signalements par zone géographique (utilisation de latitude et longitude)
  async getReportsByLocation(latitude: number, longitude: number) {
    const radius = 0.1; 

    const lat = parseFloat(latitude.toString());
    const lon = parseFloat(longitude.toString());

    const reportsInRange = await this.prisma.report.findMany({
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

    return reportsInRange;
  }

  // Récupérer les signalements populaires (par exemple, par nombre de votes)
  async getPopularReports() {
    const popularReports = await this.prisma.report.findMany({
      orderBy: {
        votes: {
          _count: 'desc',
        },
      },
      take: 5, 
    });
    return popularReports;
  }

  // Récupérer les statistiques d'un événement spécifique
  async getEventStats(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: true, 
        reports: true, 
        votes: true, 
      },
    });

    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }

    return {
      totalAttendees: event.attendees.length,
      totalReports: event.reports.length, 
      totalVotes: event.votes.length,
    };
  }
}
