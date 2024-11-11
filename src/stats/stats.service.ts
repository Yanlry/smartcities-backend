import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

// Récupérer les statistiques personnelles de l'utilisateur
async getUserStats(userId: number) {
    // Vérifier que l'ID est un nombre et pas une chaîne
    const userIdAsNumber = parseInt(userId.toString(), 10);
  
    if (isNaN(userIdAsNumber)) {
      throw new Error('L\'ID de l\'utilisateur est invalide');
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
    // Recherche des signalements qui correspondent à ce type
    const reportsByType = await this.prisma.report.findMany({
      where: {
        type: type, // Filtrage selon le type
      },
    });
    return reportsByType; // Retourner les signalements complets
  }
  

  // Récupérer les signalements par zone géographique (utilisation de latitude et longitude)
  async getReportsByLocation(latitude: number, longitude: number) {
    const radius = 0.1; // Rayon de recherche (en degrés)
  
    // S'assurer que latitude et longitude sont des nombres (Float)
    const lat = parseFloat(latitude.toString());
    const lon = parseFloat(longitude.toString());
  
    // Trouver les signalements dans un rayon de latitude et longitude
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
      take: 5, // Limiter à 5 signalements les plus populaires
    });
    return popularReports;
  }


// Récupérer les statistiques d'un événement spécifique
async getEventStats(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: true,  // Nombre de participants
        reports: true,    // Signalements associés à l'événement
        votes: true,      // Votes associés à l'événement
      },
    });
  
    if (!event) {
      throw new NotFoundException('Événement non trouvé');
    }
  
    return {
      totalAttendees: event.attendees.length,
      totalReports: event.reports.length,  // Utiliser la relation `reports`
      totalVotes: event.votes.length,
    };
  }
  
}
