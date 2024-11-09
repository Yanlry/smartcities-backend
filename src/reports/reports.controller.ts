import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './reports.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // CRÉE UN NOUVEAU SIGNAL
  @Post()
  async createReport(@Body() reportData: any) {
    return this.reportService.createReport(reportData);
  }

  // LISTE LES SIGNALS AVEC FILTRES OPTIONNELS
  @Get()
  async listReports(@Query() filters: any) {
    return this.reportService.listReports(filters);
  }

  // RÉCUPÈRE LES DÉTAILS D'UN SIGNAL PAR ID
  @Get(':id')
  async getReportById(@Param('id') id: string) {
    return this.reportService.getReportById(Number(id));
  }

  // MET À JOUR UN SIGNAL
  @Put(':id')
  async updateReport(@Param('id') id: string, @Body() updateData: any) {
    return this.reportService.updateReport(Number(id), updateData);
  }

  // SUPPRIME UN SIGNAL
  @Delete(':id')
  async deleteReport(@Param('id') id: string) {
    return this.reportService.deleteReport(Number(id));
  }

  // VOTE POUR OU CONTRE UN SIGNAL
  @Post('vote')
  async voteOnReport(@Body() voteData: any) {
    return this.reportService.voteOnReport(voteData);
  }

  // AJOUTE UN COMMENTAIRE À UN SIGNAL
  @Post('comment')
  async commentOnReport(@Body() commentData: any) {
    return this.reportService.commentOnReport(commentData);
  }

   // ROUTE POUR RÉCUPÉRER LES COMMENTAIRES D'UN SIGNAL
   @Get(':id/comments')
   async getCommentsByReportId(@Param('id') id: string) {
     const reportId = parseInt(id, 10);
     return this.reportService.getCommentsByReportId(reportId);
   }
}
