import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  // CRÉE UN NOUVEAU SIGNAL
  async createReport(reportData: any) {
    if (!reportData.title || !reportData.description || !reportData.userId || !reportData.type) {
      throw new Error("Title, description, userId, and type are required");
    }

    const report = await this.prisma.report.create({
      data: {
        title: reportData.title,
        description: reportData.description,
        userId: reportData.userId,
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        type: reportData.type, // Inclure le type du rapport
      },
    });

    // Trouver les abonnés proches
    const nearbySubscribers = await this.prisma.notificationSubscription.findMany({
      where: {
        OR: [
          { city: reportData.city },
          {
            latitude: {
              gte: reportData.latitude - 0.1, // Ajuste selon la distance
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

    // Envoyer une notification à chaque abonné
    for (const subscriber of nearbySubscribers) {
      await this.notificationService.createNotification(
        subscriber.userId,
        `Nouveau signalement dans votre zone : ${reportData.title}`
      );
    }

    return report;
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
        type: true, // Assurez-vous que `type` est sélectionné
        votes: {
          select: {
            type: true,
          },
        },
      },
    });

    return reports.map((report) => {
      const upVotes = report.votes.filter(vote => vote.type === 'up').length;
      const downVotes = report.votes.filter(vote => vote.type === 'down').length;
      return {
        ...report,
        upVotes,
        downVotes,
      };
    });
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
        type: true, // Assurez-vous que le `type` est récupéré
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
      data: updateData,  // Le `updateData` pourrait inclure `type`
    });
  }
  
  // SUPPRIME UN SIGNAL
  async deleteReport(id: number) {
    return this.prisma.report.delete({
      where: { id },
    });
  }

  // VOTE POUR OU CONTRE UN SIGNAL
  async voteOnReport(voteData: { reportId: number, userId: number, type: string }) {
    const { reportId, userId, type } = voteData;
    await this.prisma.vote.create({
      data: {
        reportId,
        userId,
        type,
      },
    });
    return { message: 'Vote enregistré avec succès' };
  }

  // AJOUTE UN COMMENTAIRE À UN SIGNAL
  async commentOnReport(commentData: { reportId: number, userId: number, text: string }) {
    const { reportId, userId, text } = commentData;

    // Vérifier que tous les champs sont fournis
    if (!reportId || !userId || !text) {
      throw new Error("Report ID, User ID, and Comment text are required");
    }

    // Créer le commentaire dans la base de données
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
