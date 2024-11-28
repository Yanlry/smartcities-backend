import { Controller, Get, Post, Put, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ReportService } from './reports.service';
import { VoteOnReportDto } from './dto/vote-on-report.dto';
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // CRÉE UN NOUVEAU SIGNAL
  @Post()
  async createReport(@Body() reportData: any) {
    // Vérifier que les données nécessaires sont présentes
    if (!reportData.latitude || !reportData.longitude) {
      throw new BadRequestException('La latitude et la longitude sont nécessaires pour créer un signalement');
    }
    return this.reportService.createReport(reportData);
  }

  // LISTE LES SIGNALS AVEC FILTRES OPTIONNELS
  @Get()
  async listReports(
    @Query() otherFilters: any, 
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string, 
    @Query('radiusKm') radiusKm: string = '10', 
  ) {
    // Validation des paramètres géographiques
    if ((latitude && isNaN(Number(latitude))) || (longitude && isNaN(Number(longitude)))) {
      throw new BadRequestException('Latitude et longitude doivent être des nombres valides.');
    }
    if (radiusKm && isNaN(Number(radiusKm))) {
      throw new BadRequestException('radiusKm doit être un nombre valide.');
    }
    // Appel du service avec les paramètres validés
    return this.reportService.listReports({ latitude, longitude, radiusKm, ...otherFilters });
  }
  @Get('/categories')
  async listCategories() {
    return this.reportService.listCategories();
  }
  @Get(':id')
  async getReportById(
    @Param('id') id: number,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string
  ) {
    if (!latitude || !longitude) {
      throw new BadRequestException('Latitude and longitude are required');
    }
    return this.reportService.getReportById(id, Number(latitude), Number(longitude));
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
  async voteOnReport(@Body() voteData: VoteOnReportDto) {
    console.log('Données reçues pour voter :', voteData);
  
    const { reportId, userId, type, latitude, longitude } = voteData;
  
    // Validation des données
    if (!['up', 'down'].includes(type)) {
      throw new BadRequestException('Le type de vote est invalide.');
    }
  
    if (!latitude || !longitude) {
      throw new BadRequestException('La latitude et la longitude sont nécessaires pour voter.');
    }
  
    return this.reportService.voteOnReport(voteData);
  }
  
  // AJOUTE UN COMMENTAIRE À UN SIGNAL
  @Post('comment')
  async commentOnReport(@Body() commentData: any) {
    // Vérifier que la latitude et la longitude sont présentes pour valider la proximité
    if (!commentData.latitude || !commentData.longitude) {
      throw new BadRequestException('La latitude et la longitude sont nécessaires pour commenter');
    }
    return this.reportService.commentOnReport(commentData);
  }

  // ROUTE POUR RÉCUPÉRER LES COMMENTAIRES D'UN SIGNAL
  @Get(':id/comments')
  async getCommentsByReportId(@Param('id') id: string) {
    const reportId = parseInt(id, 10);
    return this.reportService.getCommentsByReportId(reportId);
  }
}
