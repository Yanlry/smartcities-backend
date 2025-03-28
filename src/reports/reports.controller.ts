import {
  Controller,
  UseGuards,
  Get,
  Post,
  Logger,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  BadRequestException,
  UnauthorizedException,
  Request,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ReportService } from './reports.service';
import { VoteOnReportDto } from './dto/vote-on-report.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from '../services/s3/s3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  
  async createReport(
    @Body() reportData: any,
    @UploadedFiles() photos: Express.Multer.File[]
  ) {
    console.log('Données reçues pour le signalement :', reportData);

    if (!reportData.latitude || !reportData.longitude) {
      throw new BadRequestException(
        'La latitude et la longitude sont nécessaires pour créer un signalement'
      );
    }

    const photoUrls = [];
    if (photos && photos.length > 0) {
      const validPhotos = photos.filter(
        (file) => file.buffer && file.originalname && file.mimetype
      );

      for (const photo of validPhotos) {
        try {
          const url = await this.s3Service.uploadFile(photo);
          photoUrls.push(url);
        } catch (error) {
          console.error(
            `Erreur lors de l'upload de la photo ${photo.originalname}:`,
            error.message
          );
          throw new BadRequestException(
            `Erreur lors de l'upload de la photo ${photo.originalname}: ${error.message}`
          );
        }
      }

      console.log('URLs des photos uploadées :', photoUrls);
    } else {
      console.log('Aucune photo fournie pour ce signalement.');
    }

    return this.reportService.createReport(reportData, photoUrls);
  }

  // LISTE LES SIGNALS AVEC FILTRES OPTIONNELS
  @Get()
  async listReports(
    @Query() otherFilters: any,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm: string = '10'
  ) {
    if (
      (latitude && isNaN(Number(latitude))) ||
      (longitude && isNaN(Number(longitude)))
    ) {
      throw new BadRequestException(
        'Latitude et longitude doivent être des nombres valides.'
      );
    }
    if (radiusKm && isNaN(Number(radiusKm))) {
      throw new BadRequestException('radiusKm doit être un nombre valide.');
    }
    return this.reportService.listReports({
      latitude,
      longitude,
      radiusKm,
      ...otherFilters,
    });
  }

  @Get('/categories')
  async listCategories() {
    return this.reportService.listCategories();
  }

  @Get('statistics')
  async getStatisticsByCategory(@Query('nomCommune') nomCommune: string) {
    if (!nomCommune) {
      throw new BadRequestException('Le champ nomCommune est requis.');
    }
    return await this.reportService.getStatisticsByCategoryForCity(nomCommune);
  }

  @Get(':id')
  async getReportById(
    @Param('id') id: number,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string
  ) {
    const lat = latitude ? Number(latitude) : undefined;
    const lon = longitude ? Number(longitude) : undefined;

    return this.reportService.getReporById(id, lat, lon);
  }

  @Put(':id')
  async updateReport(@Param('id') id: string, @Body() updateData: any) {
    console.log('ID reçu dans le contrôleur :', id);
    console.log('Données reçues dans le contrôleur :', updateData);

    const numericId = Number(id);
    if (isNaN(numericId)) {
      console.error('ID non valide :', id);
      throw new BadRequestException("L'ID doit être un nombre.");
    }

    const result = await this.reportService.updateReport(numericId, updateData);
    console.log('Résultat de la mise à jour renvoyé par le service :', result);
    return result;
  }

  // SUPPRIME UN SIGNAL
  @Delete(':id')
  async deleteReport(@Param('id') id: string) {
    return this.reportService.deleteReport(Number(id));
  }

  @Delete('comment/:id')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('id') commentId: number, @Req() req: any) {
    const userId = req.user?.id;
  
    if (!userId) {
      console.log("Utilisateur non authentifié ou JWT invalide.");
      throw new UnauthorizedException("Utilisateur non authentifié.");
    }
  
    console.log("Utilisateur authentifié :", userId);
  
    return this.reportService.deleteComment(commentId, userId);
  }

  // VOTE POUR OU CONTRE UN SIGNAL
  @Post('vote')
  async voteOnReport(@Body() voteData: VoteOnReportDto) {
    console.log('Données reçues pour voter :', voteData);

    const { reportId, userId, type, latitude, longitude } = voteData;

    if (!['up', 'down'].includes(type)) {
      throw new BadRequestException('Le type de vote est invalide.');
    }

    if (!latitude || !longitude) {
      throw new BadRequestException(
        'La latitude et la longitude sont nécessaires pour voter.'
      );
    }

    return this.reportService.voteOnReport(voteData);
  }

  @Post('comment')
  async commentOnReport(@Body() commentData: any) {
    console.log('Données reçues dans le contrôleur :', commentData);

    if (
      !commentData.text ||
      typeof commentData.text !== 'string' ||
      commentData.text.trim() === ''
    ) {
      console.error(
        'Le contenu du commentaire est requis mais manquant ou invalide.'
      );
      throw new BadRequestException('Le contenu du commentaire est requis.');
    }

    return this.reportService.commentOnReport(commentData);
  }

  @UseGuards(JwtAuthGuard) 
  @Get(':id/comments')
  async getCommentsByReportId(@Param('id') id: string, @Request() req: any) {
    const reportId = parseInt(id, 10);
    const userId = req.user?.id;  

    console.log('Utilisateur connecté (userId) :', userId);

    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }

    return this.reportService.getCommentsByReportId(reportId, userId);
  }
  
  @Post('comments/:commentId/like')
  async toggleLikeComment(
    @Param('commentId') commentId: number,
    @Body('userId') userId: number
  ) {
    return this.reportService.toggleLikeComment(commentId, userId);
  }
}
