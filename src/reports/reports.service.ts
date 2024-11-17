import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  // CRÉE UN NOUVEAU SIGNAL
  async createReport(reportData: any) {
    console.log('Données reçues :', reportData);

    // Validation des données requises
    if (!reportData.title || !reportData.description || !reportData.userId || !reportData.type) {
      throw new BadRequestException('Les champs title, description, userId et type sont obligatoires');
    }

    if (!reportData.city || reportData.latitude === undefined || reportData.longitude === undefined) {
      throw new BadRequestException('Les champs city, latitude et longitude sont obligatoires');
    }

    // Vérifier si l'utilisateur existe
    const user = await this.prisma.user.findUnique({ where: { id: reportData.userId } });
    console.log('Utilisateur trouvé :', user);

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Met à jour les coordonnées de l'utilisateur si elles sont absentes
    if (!user.latitude || !user.longitude) {
      console.log("Mise à jour des coordonnées de l'utilisateur...");
      await this.prisma.user.update({
        where: { id: reportData.userId },
        data: {
          latitude: reportData.latitude,
          longitude: reportData.longitude,
        },
      });
    }

    // Création du signalement dans la base de données
    const report = await this.prisma.report.create({
      data: {
        title: reportData.title,
        description: reportData.description,
        userId: reportData.userId,
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        city: reportData.city,
        type: reportData.type,
        createdAt: new Date(),
      },
    });

    console.log('Signalement créé :', report);

    // Notification des abonnés proches
    const nearbySubscribers = await this.prisma.notificationSubscription.findMany({
      where: {
        OR: [
          { city: reportData.city },
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

    for (const subscriber of nearbySubscribers) {
      await this.notificationService.createNotification(
        subscriber.userId,
        `Nouveau signalement dans votre zone : ${reportData.title}`,
        'report',
        report.id,
      );
    }

    return report;
  }


  async isWithinRadius(lat1: number, lon1: number, userId: number): Promise<boolean> {
    // Récupérer les coordonnées de l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    // Vérification des coordonnées de l'utilisateur
    if (!user || user.latitude === null || user.longitude === null) {
      throw new BadRequestException("Utilisateur non trouvé ou coordonnées manquantes");
    }

    // Calculer la distance
    const distance = this.calculateDistance(lat1, lon1, user.latitude, user.longitude);
    console.log(`Distance calculée : ${distance} mètres`);
    console.log('Coordonnées utilisateur :', user.latitude, user.longitude);
    console.log('Coordonnées signalement :', lat1, lon1);
    console.log('Distance calculée :', distance);

    // Vérifier si la distance est inférieure ou égale à 50 mètres
    return distance <= 50;
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

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
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
