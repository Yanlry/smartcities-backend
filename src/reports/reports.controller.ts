import { Controller, Get, Post, Logger, Put, Delete, Param, Body, Query, BadRequestException, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ReportService } from './reports.service';
import { VoteOnReportDto } from './dto/vote-on-report.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from '../services/s3/s3.service';


@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly s3Service: S3Service
  ) {}

  private readonly logger = new Logger(ReportController.name);

  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', 7, {
      limits: { fileSize: 10 * 1024 * 1024 }, // Limite à 10 Mo
    }),
  )
  async createReport(
    @Body() reportData: any,
    @UploadedFiles() photos: Express.Multer.File[],
  ) {
    console.log('Données reçues pour le signalement :', reportData);
  
    if (!reportData.latitude || !reportData.longitude) {
      throw new BadRequestException('La latitude et la longitude sont nécessaires pour créer un signalement');
    }
  
    // Filtrer les fichiers valides
    const validPhotos = photos?.filter(
      (file) => file.buffer && file.originalname && file.mimetype,
    ) || [];
    if (validPhotos.length === 0) {
      throw new BadRequestException('Aucun fichier valide trouvé.');
    }
  
  
    const photoUrls = [];
    for (const photo of validPhotos) {
      try {
        const url = await this.s3Service.uploadFile(photo);
        photoUrls.push(url);
      } catch (error) {
        console.error(`Error uploading file ${photo.originalname}:`, error.message);
        throw new BadRequestException(
          `Erreur lors de l'upload de la photo ${photo.originalname}: ${error.message}`,
        );
      }
    }
  
    console.log('URLs des photos uploadées :', photoUrls);
  
    // Appel au service pour créer le signalement
    return this.reportService.createReport(reportData, photoUrls);
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
    const lat = latitude ? Number(latitude) : undefined;
    const lon = longitude ? Number(longitude) : undefined;
  
    return this.reportService.getReportById(id, lat, lon);
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
