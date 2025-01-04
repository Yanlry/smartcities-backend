import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
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
    const { latitude, longitude, radiusKm, userId, ...otherFilters } = filters;
  
    let where: any = { ...otherFilters };
  
    if (userId) {
      where.userId = Number(userId);
    }
  
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
  async getStatisticsByCategoryForCity(nomCommune: string) {
    const statistics = await this.prisma.report.groupBy({
      by: ['type'], // Regroupe par type (catégorie)
      _count: {
        type: true, // Compte le nombre de chaque type
      },
      where: {
        city: {
          contains: nomCommune, // Vérifie que la ville correspond à la commune
          mode: 'insensitive', // Rendre la recherche insensible à la casse
        },
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

  async getReporById(
    id: number | string,
    latitude?: number,
    longitude?: number
  ) {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

    if (isNaN(numericId)) {
      throw new BadRequestException('ID invalide');
    }

    // Récupération complète du rapport
    const report = await this.prisma.report.findUnique({
      where: { id: numericId },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            useFullName: true, // Ajout
            firstName: true, // Ajout
            lastName: true,
          },
        },
        type: true,
        latitude: true,
        longitude: true,
        city: true,
        votes: {
          select: { type: true },
        },
        photos: {
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

    // Fonction récursive pour récupérer les commentaires imbriqués
    const fetchCommentsWithReplies = async (parentId: number | null) => {
      const comments = await this.prisma.comment.findMany({
        where: { reportId: numericId, parentId },
        select: {
          id: true,
          text: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              useFullName: true,
              firstName: true,
              lastName: true,
            },
          },
          replies: {
            select: {
              id: true,
              text: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  useFullName: true,
                  firstName: true,
                  lastName: true,
                },
              },
              replies: true, // Récursivité incluse
            },
          },
        },
      });

      // Ajout récursif des réponses
      return await Promise.all(
        comments.map(async (comment) => ({
          ...comment,
          replies: await fetchCommentsWithReplies(comment.id),
        }))
      );
    };

    // Récupération des commentaires principaux et leurs réponses
    const comments = await fetchCommentsWithReplies(null);

    // Calcul de la distance
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

    // Calcul des votes
    const upVotes = report.votes.filter((vote) => vote.type === 'up').length;
    const downVotes = report.votes.filter(
      (vote) => vote.type === 'down'
    ).length;

    // Retourne le rapport avec commentaires imbriqués
    return {
      ...report,
      comments,
      distance: distance !== null ? (distance < 0.001 ? 0 : distance) : null,
      upVotes,
      downVotes,
    };
  }

  async getCommentsWithReplies(reportId: number) {
    const comments = await this.prisma.comment.findMany({
      where: { reportId, parentId: null },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            photos: {
              where: { isProfile: true }, // Récupère uniquement la photo de profil
              select: { url: true },
            },
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                useFullName: true,
                photos: {
                  where: { isProfile: true }, // Récupère uniquement la photo de profil
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

    // Enrichir chaque commentaire avec `profilePhoto`
    return comments.map((comment) => ({
      ...comment,
      user: {
        ...comment.user,
        profilePhoto:
          comment.user.photos.length > 0 ? comment.user.photos[0].url : null,
      },
      replies: comment.replies.map((reply) => ({
        ...reply,
        user: {
          ...reply.user,
          profilePhoto:
            reply.user.photos.length > 0 ? reply.user.photos[0].url : null,
        },
      })),
    }));
  }

  async commentOnReport(commentData: {
    userId: number;
    reportId: number;
    text: string;
    parentId?: number;
  }) {
    const { userId, reportId, text, parentId } = commentData;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new BadRequestException('Le contenu du commentaire est requis.');
    }

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Signalement non trouvé.');
    }

    const newComment = await this.prisma.comment.create({
      data: {
        userId,
        reportId,
        text,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            photos: {
              where: { isProfile: true },
              select: { url: true },
            },
          },
        },
      },
    });

    const commenterName = newComment.user.useFullName
      ? `${newComment.user.firstName} ${newComment.user.lastName}`
      : newComment.user.username || 'Un utilisateur';

    try {
      if (report.userId !== userId) {
        await this.notificationService.createNotification(
          report.userId,
          `${commenterName} a commenté votre signalement : "${text}"`,
          'COMMENT',
          reportId, // `relatedId`
          userId // `initiatorId` (celui qui commente)
        );
      }
    } catch (error) {
      console.error(
        'Erreur lors de la création de la notification :',
        error.message
      );
    }

    return {
      ...newComment,
      user: {
        ...newComment.user,
        profilePhoto:
          newComment.user.photos.length > 0
            ? newComment.user.photos[0].url
            : null,
      },
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

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          useFullName: true,
        },
      });
      if (!user) {
        throw new NotFoundException(
          `Utilisateur introuvable pour l'ID : ${userId}`
        );
      }

      const existingVote = await this.prisma.vote.findFirst({
        where: { reportId, userId },
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

      try {
        if (report.userId !== userId) {
          const voteTypeText = type === 'up' ? 'positif' : 'négatif';

          const voterName = user.useFullName
            ? `${user.firstName} ${user.lastName}`
            : user.username || 'Un utilisateur';

          await this.notificationService.createNotification(
            report.userId,
            `${voterName} a laissé un vote ${voteTypeText} sur votre signalement.`,
            'VOTE',
            reportId, // `relatedId`
            userId // `initiatorId`
          );
        }
      } catch (error) {
        console.error(
          'Erreur lors de la création de la notification :',
          error.message
        );
      }

      return {
        message: 'Vote enregistré avec succès',
        updatedVotes: {
          upVotes: updatedReport.upVotes,
          downVotes: updatedReport.downVotes,
        },
      };
    } catch (error) {
      console.error('Erreur inattendue :', error);
      throw new InternalServerErrorException(
        "Erreur lors de l'enregistrement du vote"
      );
    }
  }

  async deleteComment(commentId: number, userId: number) {
    console.log(
      'Suppression du commentaire:',
      commentId,
      "par l'utilisateur:",
      userId
    );

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { parent: true }, // Inclure le parent pour vérifier la relation
    });

    if (!comment) {
      console.log('Commentaire non trouvé.');
      throw new NotFoundException('Commentaire introuvable.');
    }

    // Vérifiez si l'utilisateur est l'auteur du commentaire ou d'une réponse
    if (comment.userId !== userId) {
      console.log(
        "Tentative de suppression non autorisée par l'utilisateur:",
        userId
      );
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à supprimer ce commentaire ou cette réponse."
      );
    }

    console.log('Suppression du commentaire ou réponse réussie.');
    return this.prisma.comment.delete({ where: { id: commentId } });
  }

  // MÉTHODE POUR RÉCUPÉRER LES COMMENTAIRES D'UN SIGNAL
  async getCommentsByReportId(reportId: number) {
    return this.prisma.comment.findMany({
      where: { reportId },
    });
  }
}
