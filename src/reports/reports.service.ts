import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException} from '@nestjs/common';
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

  // CONVERSION DES DEGRÉS EN RADIANS
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // LISTE LES SIGNALS AVEC FILTRES OPTIONNELS, ET COMPTE LES VOTES
  async listReports(filters: any) {
    const { latitude, longitude, radiusKm, ...otherFilters } = filters;

    let where: any = { ...otherFilters };

    // Ajout du filtre géographique si latitude, longitude et radiusKm sont fournis
    if (latitude && longitude && radiusKm) {
      const radiusInDegrees = Number(radiusKm) / 111; // Conversion du rayon en degrés

      where.latitude = {
        gte: Number(latitude) - radiusInDegrees,
        lte: Number(latitude) + radiusInDegrees,
      };
      where.longitude = {
        gte: Number(longitude) - radiusInDegrees,
        lte: Number(longitude) + radiusInDegrees,
      };
    }

    // Récupération des signalements avec Prisma
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
      },
    });

    // Fonction pour calculer la distance à vol d'oiseau (Haversine)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const toRadians = (degree: number) => (degree * Math.PI) / 180;
      const R = 6371; // Rayon de la Terre en kilomètres

      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance en km
    };

    // Ajout des distances et tri par distance
    const reportsWithDistances = reports.map((report) => {
      const distance = calculateDistance(
        Number(latitude),
        Number(longitude),
        report.latitude,
        report.longitude
      );

      const upVotes = report.votes.filter((vote) => vote.type === 'up').length;
      const downVotes = report.votes.filter((vote) => vote.type === 'down').length;
      const trustRate = this.calculateTrustRate(report.userId);

      return {
        ...report,
        distance, // Ajout de la distance calculée
        upVotes,
        downVotes,
        trustRate,
      };
    });

    // Tri par distance
    return reportsWithDistances.sort((a, b) => a.distance - b.distance);
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

 // RÉCUPÈRE LES DÉTAILS D'UN SIGNAL PAR ID AVEC DISTANCE ET LOCALISATION
 async getReportById(id: number | string, latitude: number, longitude: number) {
  // Convertir l'ID en entier
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  // Vérification si l'ID est bien un entier valide
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
    },
  });

  if (!report) {
    throw new NotFoundException('Signalement introuvable');
  }

  // Calcul de la distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRadians = (degree: number) => (degree * Math.PI) / 180;
    const R = 6371; // Rayon de la Terre en kilomètres

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en km
  };

  const distance = calculateDistance(latitude, longitude, report.latitude, report.longitude);

  const upVotes = report.votes.filter((vote) => vote.type === 'up').length;
  const downVotes = report.votes.filter((vote) => vote.type === 'down').length;

  return {
    ...report,
    distance: distance < 0.001 ? 0 : distance,
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

  async voteOnReport(voteData: { reportId: number, userId: number, type: string, latitude: number, longitude: number }) {
    const { reportId, userId, type } = voteData;
  
    try {
      if (!type || !['up', 'down'].includes(type)) {
        throw new BadRequestException('Type de vote invalide.');
      }
      const report = await this.prisma.report.findUnique({ where: { id: reportId } });
      if (!report) {
        throw new NotFoundException(`Signalement introuvable pour l'ID : ${reportId}`);
      }
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`Utilisateur introuvable pour l'ID : ${userId}`);
      }
      const existingVote = await this.prisma.vote.findFirst({
        where: {
          reportId,
          userId,
        },
      });
  
      if (existingVote) {
        throw new BadRequestException('Vous avez déjà voté pour ce signalement.');
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        console.error('Erreur métier :', error.message);
      } else {
        console.error('Erreur inattendue :', error);
      }
      throw new InternalServerErrorException('Erreur lors de l\'enregistrement du vote');
    }
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
