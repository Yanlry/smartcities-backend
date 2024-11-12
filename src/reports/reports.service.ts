import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

 // CRÉE UN NOUVEAU SIGNAL
  async createReport(reportData: any) {
    // Vérifier que les informations de localisation sont présentes
    if (!reportData.title || !reportData.description || !reportData.userId || !reportData.type) {
      throw new BadRequestException('Title, description, userId, and type are required');
    }

    // Vérifier que le lieu (ville, latitude, longitude) est présent
    if (!reportData.city || !reportData.latitude || !reportData.longitude) {
      throw new BadRequestException('City, latitude, and longitude are required to create a report');
    }

    // Vérification de la proximité (rayon de 50m)
    if (!await this.isWithinRadius(reportData.latitude, reportData.longitude, reportData.userId)) {
      throw new BadRequestException('Vous devez être dans un rayon de 50 mètres pour signaler un événement');
    }

    // Créer le signalement dans la base de données avec toutes les informations nécessaires
    const report = await this.prisma.report.create({
      data: {
        title: reportData.title,
        description: reportData.description,
        userId: reportData.userId,
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        city: reportData.city,  // Inclure la ville
        type: reportData.type,
        createdAt: new Date(),
      },
    });

    // Trouver les abonnés proches dans la même ville ou rayon
    const nearbySubscribers = await this.prisma.notificationSubscription.findMany({
      where: {
        OR: [
          { city: reportData.city },  // Ville à vérifier
          {
            latitude: {
              gte: reportData.latitude - 0.1,
              lte: reportData.latitude + 0.1,
            },
            longitude: {
              gte: reportData.longitude - 0.1,
              lte: reportData.longitude + 0.1,
            },
          },
        ],
      },
      select: { userId: true },
    });

    // Envoyer une notification à chaque abonné dans la zone
    for (const subscriber of nearbySubscribers) {
      await this.notificationService.createNotification(
        subscriber.userId,  // userId (l'utilisateur qui recevra la notification)
        `Nouveau signalement dans votre zone : ${reportData.title}`,  // message (le message de notification)
        'report',  // type (le type de notification, ici 'report')
        report.id   // relatedId (l'ID du rapport concerné)
      );      
    }

    return report;
  }

  async isWithinRadius(latitude: number, longitude: number, userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });
  
    if (!user || user.latitude === null || user.longitude === null) {
      throw new BadRequestException("Utilisateur non trouvé ou coordonnées manquantes");
    }
  
    const distance = this.calculateDistance(latitude, longitude, user.latitude, user.longitude);
    return distance <= 50; // 50 mètres de rayon
  }
  
  // MISE À JOUR DU TRUST RATE DE L'UTILISATEUR
  async updateUserTrustRate(userId: number) {
    const votes = await this.prisma.vote.findMany({
      where: { userId },
    });

    let trustRate = 0;
    let validVotes = 0;

    votes.forEach(vote => {
      if (vote.type === 'up') {
        trustRate += 1;
        validVotes += 1;
      } else if (vote.type === 'down') {
        trustRate -= 1;
      }
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustRate: validVotes > 0 ? trustRate / validVotes : 0, 
      },
    });
  }

  // CALCUL DE LA DISTANCE ENTRE DEUX POINTS (utilise la formule Haversine)
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

  // CONVERSION DES DEGRÉS EN RADIANS
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // LISTE LES SIGNALS AVEC FILTRES OPTIONNELS, ET COMPTE LES VOTES
  async listReports(filters: any) {
    const reports = await this.prisma.report.findMany({
      where: filters,
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        type: true,
        votes: {
          select: {
            type: true,
          },
        },
      },
    });

    return reports.map((report) => {
      const upVotes = report.votes.filter((vote) => vote.type === 'up').length;
      const downVotes = report.votes.filter((vote) => vote.type === 'down').length;

      // Calculer la validité des votes et ajuster le trustRate
      const trustRate = this.calculateTrustRate(report.userId);

      return {
        ...report,
        upVotes,
        downVotes,
        trustRate,
      };
    });
  }

  // CALCUL DU TRUST RATE DE L'UTILISATEUR EN FONCTION DE SES VOTES
  private async calculateTrustRate(userId: number): Promise<number> {
    const votes = await this.prisma.vote.findMany({
      where: { userId },
    });

    let trustRate = 0;
    let validVotes = 0;

    votes.forEach((vote) => {
      if (vote.type === 'up') {
        trustRate += 1;
        validVotes += 1;
      } else if (vote.type === 'down') {
        trustRate -= 1;
      }
    });

    return validVotes > 0 ? trustRate / validVotes : 0; // Moyenne des votes valides
  }

  // RÉCUPÈRE LES DÉTAILS D'UN SIGNAL PAR ID
  async getReportById(id: number) {
    return this.prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        type: true,
        votes: {
          select: {
            type: true,
          },
        },
      },
    });
  }

  // MET À JOUR UN SIGNAL
  async updateReport(id: number, updateData: any) {
    return this.prisma.report.update({
      where: { id },
      data: updateData,
    });
  }

  // SUPPRIME UN SIGNAL
  async deleteReport(id: number) {
    return this.prisma.report.delete({
      where: { id },
    });
  }

  // VOTE POUR OU CONTRE UN SIGNAL
  async voteOnReport(voteData: { reportId: number, userId: number, type: string, latitude: number, longitude: number }) {
    const { reportId, userId, type, latitude, longitude } = voteData;

    // Vérifier que l'utilisateur est à proximité avant de permettre le vote
    if (!(await this.isWithinRadius(latitude, longitude, userId))) {
      throw new BadRequestException('Vous devez être dans un rayon de 50 mètres pour voter');
    }

    await this.prisma.vote.create({
      data: {
        reportId,
        userId,
        type,
      },
    });

    // Mettre à jour le trustRate de l'utilisateur après un vote
    await this.updateUserTrustRate(userId);

    return { message: 'Vote enregistré avec succès' };
  }

  // AJOUTE UN COMMENTAIRE À UN SIGNAL
  async commentOnReport(commentData: { reportId: number, userId: number, text: string, latitude: number, longitude: number }) {
    const { reportId, userId, text, latitude, longitude } = commentData;

    // Vérifier que l'utilisateur est à proximité avant de permettre le commentaire
    if (!(await this.isWithinRadius(latitude, longitude, userId))) {
      throw new BadRequestException('Vous devez être dans un rayon de 50 mètres pour commenter');
    }

    return this.prisma.comment.create({
      data: {
        reportId,
        userId,
        text,
      },
    });
  }

  // MÉTHODE POUR RÉCUPÉRER LES COMMENTAIRES D'UN SIGNAL
  async getCommentsByReportId(reportId: number) {
    return this.prisma.comment.findMany({
      where: { reportId },
    });
  }
}
