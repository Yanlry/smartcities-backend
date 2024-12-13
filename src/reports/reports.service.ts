import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  // CRÉE UN NOUVEAU SIGNAL
  async createReport(reportData: any, photoUrls: string[]) {
    console.log('Données reçues :', reportData);
    console.log('Photo URLs reçues :', photoUrls);

    // Validation des champs obligatoires
    if (
      !reportData.title ||
      !reportData.description ||
      !reportData.userId ||
      !reportData.type
    ) {
      throw new BadRequestException(
        'Les champs title, description, userId et type sont obligatoires.'
      );
    }

    if (
      !reportData.city ||
      reportData.latitude === undefined ||
      reportData.longitude === undefined
    ) {
      throw new BadRequestException(
        'Les champs city, latitude et longitude sont obligatoires.'
      );
    }

    // Conversion des coordonnées et de l'identifiant utilisateur
    const latitude = parseFloat(reportData.latitude.toString());
    const longitude = parseFloat(reportData.longitude.toString());
    const userId = parseInt(reportData.userId.toString(), 10);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(userId)) {
      throw new BadRequestException(
        'Latitude, longitude, et userId doivent être des nombres valides.'
      );
    }

    // Vérification de l'utilisateur
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    console.log('Utilisateur trouvé :', user);

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé.');
    }

    // Mise à jour des coordonnées utilisateur si elles sont absentes
    if (!user.latitude || !user.longitude) {
      console.log("Mise à jour des coordonnées de l'utilisateur...");
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          latitude,
          longitude,
        },
      });
    }

    // Création du signalement dans la base de données
    const report = await this.prisma.report.create({
      data: {
        title: reportData.title,
        description: reportData.description,
        userId,
        latitude,
        longitude,
        city: reportData.city,
        type: reportData.type,
        createdAt: new Date(),
      },
    });

    console.log('Signalement créé :', report);

    // Ajout des photos au signalement
    if (photoUrls.length > 0) {
      const photosData = photoUrls.map((url) => ({
        url,
        reportId: report.id,
      }));

      console.log('Photos à associer au signalement :', photosData);

      await this.prisma.photo.createMany({
        data: photosData,
      });
    }

    // Envoi de notifications aux abonnés proches
    if (reportData.city) {
      const nearbySubscribers =
        await this.prisma.notificationSubscription.findMany({
          where: {
            OR: [
              { city: reportData.city },
              {
                latitude: {
                  gte: latitude - 0.1,
                  lte: latitude + 0.1,
                },
                longitude: {
                  gte: longitude - 0.1,
                  lte: longitude + 0.1,
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
          report.id
        );
      }
    }

    return report;
  }

  async listReports(filters: any) {
    const { latitude, longitude, radiusKm, ...otherFilters } = filters;

    let where: any = { ...otherFilters };

    if (latitude && longitude && radiusKm) {
      const radiusInDegrees = Number(radiusKm) / 111;

      where.latitude = {
        gte: Number(latitude) - radiusInDegrees,
        lte: Number(latitude) + radiusInDegrees,
      };
      where.longitude = {
        gte: Number(longitude) - radiusInDegrees,
        lte: Number(longitude) + radiusInDegrees,
      };
    }

    const reports = await this.prisma.report.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        city: true,
        type: true,
        latitude: true,
        longitude: true,
        votes: {
          select: {
            type: true,
          },
        },
        photos: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    });

    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number => {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null)
        return Infinity;
      const toRadians = (degree: number) => (degree * Math.PI) / 180;
      const R = 6371;
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
          Math.cos(toRadians(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const reportsWithDistances = await Promise.all(
      reports.map(async (report) => {
        const distance = calculateDistance(
          Number(latitude),
          Number(longitude),
          report.latitude,
          report.longitude
        );

        const upVotes = report.votes.filter(
          (vote) => vote.type === 'up'
        ).length;
        const downVotes = report.votes.filter(
          (vote) => vote.type === 'down'
        ).length;

        const trustRate = await this.calculateTrustRate(report.userId);

        return {
          ...report,
          distance,
          upVotes,
          downVotes,
          trustRate,
          photos: report.photos,
        };
      })
    );

    return reportsWithDistances.sort((a, b) => a.distance - b.distance);
  }

  async listCategories() {
    return [
      { name: 'danger', icon: 'alert-circle-outline' },
      { name: 'travaux', icon: 'construct-outline' },
      { name: 'nuisance', icon: 'volume-high-outline' },
      { name: 'reparation', icon: 'hammer-outline' },
      { name: 'pollution', icon: 'leaf-outline' },
    ];
  }
  // SERVICE : Récupère les statistiques des signalements par catégorie
  async getStatisticsByCategory() {
    const statistics = await this.prisma.report.groupBy({
      by: ['type'], // Regroupe par type (catégorie)
      _count: {
        type: true, // Compte le nombre de chaque type
      },
    });

    // Formate les données pour le frontend
    return statistics.map((stat) => ({
      label: stat.type,
      count: stat._count.type,
    }));
  }

  async isWithinRadius(
    lat1: number,
    lon1: number,
    userId: number
  ): Promise<boolean> {
    // Récupérer les coordonnées de l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    // Vérification des coordonnées de l'utilisateur
    if (!user || user.latitude === null || user.longitude === null) {
      throw new BadRequestException(
        'Utilisateur non trouvé ou coordonnées manquantes'
      );
    }

    // Calculer la distance
    const distance = this.calculateDistance(
      lat1,
      lon1,
      user.latitude,
      user.longitude
    );
    console.log(`Distance calculée : ${distance} mètres`);
    console.log('Coordonnées utilisateur :', user.latitude, user.longitude);
    console.log('Coordonnées signalement :', lat1, lon1);
    console.log('Distance calculée :', distance);

    // Vérifier si la distance est inférieure ou égale à 50 mètres
    return distance <= 50;
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
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

  // MISE À JOUR DU TRUST RATE DE L'UTILISATEUR
  async updateUserTrustRate(userId: number) {
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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustRate: validVotes > 0 ? trustRate / validVotes : 0,
      },
    });
  }

  // CONVERSION DES DEGRÉS EN RADIANS
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
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

  async getReportById(
    id: number | string,
    latitude?: number,
    longitude?: number
  ) {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    if (isNaN(numericId)) {
      throw new BadRequestException('ID invalide');
    }

    const report = await this.prisma.report.findUnique({
      where: { id: numericId },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: true,
        type: true,
        latitude: true,
        longitude: true,
        city: true,
        votes: {
          select: {
            type: true,
          },
        },
        photos: {
          // Ajout des photos
          select: {
            id: true,
            url: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Signalement introuvable');
    }

    let distance = null;
    if (latitude !== undefined && longitude !== undefined) {
      const calculateDistance = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
      ): number => {
        const toRadians = (degree: number) => (degree * Math.PI) / 180;
        const R = 6371;

        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
      };

      distance = calculateDistance(
        latitude,
        longitude,
        report.latitude,
        report.longitude
      );
    }

    const upVotes = report.votes.filter((vote) => vote.type === 'up').length;
    const downVotes = report.votes.filter(
      (vote) => vote.type === 'down'
    ).length;

    return {
      ...report,
      distance: distance !== null ? (distance < 0.001 ? 0 : distance) : null,
      upVotes,
      downVotes,
    };
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

  async voteOnReport(voteData: {
    reportId: number;
    userId: number;
    type: string;
    latitude: number;
    longitude: number;
  }) {
    const { reportId, userId, type } = voteData;

    try {
      if (!type || !['up', 'down'].includes(type)) {
        throw new BadRequestException('Type de vote invalide.');
      }
      const report = await this.prisma.report.findUnique({
        where: { id: reportId },
      });
      if (!report) {
        throw new NotFoundException(
          `Signalement introuvable pour l'ID : ${reportId}`
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(
          `Utilisateur introuvable pour l'ID : ${userId}`
        );
      }
      const existingVote = await this.prisma.vote.findFirst({
        where: {
          reportId,
          userId,
        },
      });

      if (existingVote) {
        throw new BadRequestException(
          'Vous avez déjà voté pour ce signalement.'
        );
      }
      const vote = await this.prisma.vote.create({
        data: {
          reportId,
          userId,
          type,
        },
      });
      const updatedReport = await this.prisma.report.update({
        where: { id: reportId },
        data: {
          upVotes: type === 'up' ? { increment: 1 } : undefined,
          downVotes: type === 'down' ? { increment: 1 } : undefined,
        },
      });
      await this.updateUserTrustRate(userId);

      return {
        message: 'Vote enregistré avec succès',
        updatedVotes: {
          upVotes: updatedReport.upVotes,
          downVotes: updatedReport.downVotes,
        },
      };
    } catch (error) {
      // Log des erreurs spécifiques pour un meilleur débogage
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        console.error('Erreur métier :', error.message);
      } else {
        console.error('Erreur inattendue :', error);
      }
      throw new InternalServerErrorException(
        "Erreur lors de l'enregistrement du vote"
      );
    }
  }

  // AJOUTE UN COMMENTAIRE À UN SIGNAL
  async commentOnReport(commentData: {
    reportId: number;
    userId: number;
    text: string;
    latitude: number;
    longitude: number;
  }) {
    const { reportId, userId, text, latitude, longitude } = commentData;

    // Vérifier que l'utilisateur est à proximité avant de permettre le commentaire
    if (!(await this.isWithinRadius(latitude, longitude, userId))) {
      throw new BadRequestException(
        'Vous devez être dans un rayon de 50 mètres pour commenter'
      );
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
