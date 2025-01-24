import { Controller, Get, Query, Param } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // Récupérer les signalements par localisation 
  @Get('report-by-location')
  async getReportsByLocation(
    @Query('latitude') latitude: number, 
    @Query('longitude') longitude: number
  ) {
    return this.statsService.getReportsByLocation(latitude, longitude);
  }

   // Récupérer les signalements par type 
   @Get('reports-by-type/:type')
   async getReportsByType(@Param('type') type: string) {
     return this.statsService.getReportsByType(type);
   }
  // Récupérer les signalements populaires
  @Get('popular-reports')
  async getPopularReports() {
    return this.statsService.getPopularReports();
  }

  // Route pour récupérer les statistiques personnelles de l'utilisateur
  @Get('user/:userId')
  async getUserStats(@Param('userId') userId: number) {
    return this.statsService.getUserStats(userId);
  }

 // Route pour récupérer les statistiques d'un événement
@Get('event/:eventId')
async getEventStats(@Param('eventId') eventId: string) { 
  return this.statsService.getEventStats(Number(eventId));  
}

}
