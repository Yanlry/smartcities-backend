import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  // CRÉE UN NOUVEAU SIGNAL
  async createReport(reportData: any) {
    if (!reportData.title || !reportData.description || !reportData.userId) {
      throw new Error("Title, description, and userId are required");
    }
    return this.prisma.report.create({
      data: {
        title: reportData.title,
        description: reportData.description,
        userId: reportData.userId,
      },
    });
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
