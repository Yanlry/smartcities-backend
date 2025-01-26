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

    const latitude = parseFloat(reportData.latitude.toString());
    const longitude = parseFloat(reportData.longitude.toString());
    const userId = parseInt(reportData.userId.toString(), 10);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(userId)) {
      throw new BadRequestException(
        'Latitude, longitude, et userId doivent être des nombres valides.'
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    console.log('Utilisateur trouvé :', user);

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé.');
    }

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
      by: ['type'],
      _count: {
        type: true,
      },
      where: {
        city: {
          contains: nomCommune,
          mode: 'insensitive',
        },
      },
    });

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { latitude: true, longitude: true },
    });

    if (!user || user.latitude === null || user.longitude === null) {
      throw new BadRequestException(
        'Utilisateur non trouvé ou coordonnées manquantes'
      );
    }

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

    return distance <= 50;
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
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
    return validVotes > 0 ? trustRate / validVotes : 0;
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
            useFullName: true,
            firstName: true,
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
              replies: true,
            },
          },
        },
      });

      return await Promise.all(
        comments.map(async (comment) => ({
          ...comment,
          replies: await fetchCommentsWithReplies(comment.id),
        }))
      );
    };

    const comments = await fetchCommentsWithReplies(null);

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
              where: { isProfile: true },
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
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

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
          `${commenterName} a commenté votre signalement.`,
          'COMMENT',
          reportId,
          userId
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

  async updateReport(id: number, updateData: any) {
    console.log('ID reçu :', id);
    console.log('Données brutes reçues :', updateData);

    try {
      const {
        userId,
        createdAt,
        votes,
        photos,
        trustRate,
        distance,
        ...filteredData
      } = updateData;
      console.log('Données filtrées pour mise à jour :', filteredData);

      const report = await this.prisma.report.update({
        where: { id },
        data: {
          ...filteredData,
          user: userId ? { connect: { id: userId } } : undefined,
        },
      });

      console.log('Mise à jour Prisma réussie :', report);

      console.log('Suppression des anciennes photos...');
      await this.prisma.photo.deleteMany({
        where: { reportId: id },
      });

      if (photos && photos.length > 0) {
        console.log('Photos reçues pour ajout :', photos);

        const validPhotos = photos
          .filter((photo) => photo.uri || photo.url)
          .map((photo) => ({
            url: photo.url || photo.uri,
            reportId: id,
          }));

        console.log('Photos valides après transformation :', validPhotos);

        if (validPhotos.length > 0) {
          console.log('Ajout des nouvelles photos...');
          await this.prisma.photo.createMany({
            data: validPhotos,
          });
        } else {
          console.log('Aucune photo valide à ajouter.');
        }
      } else {
        console.log('Aucune nouvelle photo reçue, seulement suppression.');
      }

      return report;
    } catch (error) {
      console.error('Erreur dans Prisma :', error);
      throw new BadRequestException(
        'Impossible de mettre à jour le signalement.'
      );
    }
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

    const voter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        firstName: true,
        lastName: true,
        useFullName: true,
      },
    });

    if (!voter) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const voterName = voter.useFullName
      ? `${voter.firstName} ${voter.lastName}`
      : voter.username || 'Un utilisateur';

    const existingVote = await this.prisma.vote.findFirst({
      where: { reportId, userId },
    });

    let updatedReport;

    if (existingVote) {
      if (existingVote.type !== type) {
        await this.prisma.vote.update({
          where: { id: existingVote.id },
          data: { type },
        });

        updatedReport = await this.prisma.report.update({
          where: { id: reportId },
          data: {
            upVotes: type === 'up' ? { increment: 1 } : { decrement: 1 },
            downVotes: type === 'down' ? { increment: 1 } : { decrement: 1 },
          },
        });
      } else {
        await this.prisma.vote.delete({
          where: { id: existingVote.id },
        });

        updatedReport = await this.prisma.report.update({
          where: { id: reportId },
          data: {
            upVotes: type === 'up' ? { decrement: 1 } : undefined,
            downVotes: type === 'down' ? { decrement: 1 } : undefined,
          },
        });
      }
    } else {
      await this.prisma.vote.create({
        data: { reportId, userId, type },
      });

      updatedReport = await this.prisma.report.update({
        where: { id: reportId },
        data: {
          upVotes: type === 'up' ? { increment: 1 } : undefined,
          downVotes: type === 'down' ? { increment: 1 } : undefined,
        },
      });
    }

    try {
      if (report.userId !== userId) {
        const voteType = type === 'up' ? 'positivement' : 'négativement';
        await this.notificationService.createNotification(
          report.userId,
          `${voterName} a voté ${voteType} sur votre signalement.`,
          'VOTE',
          reportId,
          userId
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
      include: { parent: true },
    });

    if (!comment) {
      console.log('Commentaire non trouvé.');
      throw new NotFoundException('Commentaire introuvable.');
    }

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
  async getCommentsByReportId(reportId: number, userId: number) {
    const comments = await this.prisma.comment.findMany({
      where: { reportId, parentId: null }, // Récupère uniquement les commentaires principaux
      include: {
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
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
            likes: true, // Inclut les likes pour chaque réponse
          },
        },
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
        likes: true, // Inclut les likes pour chaque commentaire principal
      },
    });
  
    return comments.map((comment) => ({
      ...comment,
      user: {
        ...comment.user,
        profilePhoto: comment.user.photos?.[0]?.url || null, // Transforme `photos` en `profilePhoto`
      },
      likesCount: comment.likes.length, // Compteur total des likes pour le commentaire principal
      likedByUser: comment.likes.some((like) => like.userId === userId), // Vérifie si l'utilisateur connecté a liké le commentaire principal
      replies: comment.replies.map((reply) => ({
        ...reply,
        user: {
          ...reply.user,
          profilePhoto: reply.user.photos?.[0]?.url || null, // Transforme `photos` en `profilePhoto` pour les réponses
        },
        likesCount: reply.likes.length, // Compteur total des likes pour la réponse
        likedByUser: reply.likes.some((like) => like.userId === userId), // Vérifie si l'utilisateur connecté a liké la réponse
      })),
    }));
  }
  async toggleLikeComment(commentId: number, userId: number) {
    const existingLike = await this.prisma.commentLike.findFirst({
      where: { commentId, userId },
    });
  
    if (existingLike) {
      await this.prisma.commentLike.delete({
        where: { id: existingLike.id },
      });
  
      return { message: 'Vous venez de déliker le commentaire.' };
    } else {
      await this.prisma.commentLike.create({
        data: {
          commentId,
          userId,
        },
      });
  
      return { message: 'Bravo vous avez liké le commentaire.' };
    }
  }
}
