import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { MapService } from './map.service';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('/reports')
  async getReports() {
    return await this.mapService.getReports();
  }

  @Get('/events')
  async getEvents() {
    return await this.mapService.getEvents();
  }

  @Get('/filter')
  async filterMapItems(@Query('type') type: string) {
    return await this.mapService.filterMapItems(type);
  }

  @Get('/nearby')
  async getNearbyItems(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('userId') userId: number
  ) {
    if (!latitude || !longitude) {
      throw new BadRequestException(
        'La latitude et la longitude sont nécessaires pour obtenir les éléments à proximité.'
      );
    }

    const { reports, events } = await this.mapService.getNearbyItems(
      latitude,
      longitude
    );

    const userInteractions = await this.checkUserInteractions(
      userId,
      reports,
      events,
      latitude,
      longitude
    );

    return {
      reports,
      events,
      userInteractions,
    };
  }

  private async checkUserInteractions(
    userId: number,
    reports: any[],
    events: any[],
    latitude: number,
    longitude: number
  ) {
    const interactions = { reports: [], events: [] };

    for (const report of reports) {
      const canInteract = await this.mapService.isUserWithinRadius(
        latitude,
        longitude,
        report.latitude,
        report.longitude
      );
      if (canInteract) {
        interactions.reports.push({ reportId: report.id, canInteract });
      }
    }

    for (const event of events) {
      const canInteract = await this.mapService.isUserWithinRadius(
        latitude,
        longitude,
        event.latitude,
        event.longitude
      );
      if (canInteract) {
        interactions.events.push({ eventId: event.id, canInteract });
      }
    }

    return interactions;
  }
}
