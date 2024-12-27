import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  Query,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { S3Service } from '../services/s3/s3.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly s3Service: S3Service
  ) {}

  private readonly logger = new Logger(EventsController.name);

  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', 7, {
      limits: { fileSize: 10 * 1024 * 1024 }, // Limite à 10 Mo
    })
  )
  async create(
    @Body() createEventDto: CreateEventDto,
    @UploadedFiles() photos: Express.Multer.File[]
  ) {
    this.logger.log('Creating event...');
    this.logger.debug('Received Body:', createEventDto);
    this.logger.debug('Received Files:', photos);

    if (!photos || photos.length === 0) {
      throw new BadRequestException('Aucun fichier reçu.');
    }

    // Filtrer les fichiers valides
    const validPhotos = photos.filter(
      (file) => file.buffer && file.originalname && file.mimetype
    );
    if (validPhotos.length === 0) {
      throw new BadRequestException('Aucun fichier valide trouvé.');
    }
    this.logger.debug('Valid Files:', validPhotos);

    const photoUrls = [];
    for (const photo of validPhotos) {
      try {
        this.logger.debug('Uploading valid file:', {
          name: photo.originalname,
          mimetype: photo.mimetype,
          size: photo.size,
        });
        const url = await this.s3Service.uploadFile(photo);
        photoUrls.push(url);
      } catch (error) {
        this.logger.error(
          `Error uploading file ${photo.originalname}:`,
          error.message
        );
        throw new BadRequestException(
          `Erreur lors de l'upload de la photo ${photo.originalname}: ${error.message}`
        );
      }
    }

    this.logger.debug('All uploaded photo URLs:', photoUrls);

    // Appel au service pour créer l'événement
    try {
      const event = await this.eventsService.create(createEventDto, photoUrls);
      this.logger.log('Event created successfully:', event);
      return event;
    } catch (error) {
      this.logger.error('Error creating event:', error.message);
      throw new BadRequestException(
        `Erreur lors de la création de l'événement : ${error.message}`
      );
    }
  }

  @Get('/by-date')
  async findEventsByDate(@Query('date') date: string) {
    return this.eventsService.findEventsByDate(date);
  }

  @Get()
  findAll(@Query('userId') userId?: string) {
    return this.eventsService.findAll(userId);
  }

  @Get(':eventId/is-registered')
  async isRegistered(
    @Param('eventId') eventId: number,
    @Query('userId') userId: number
  ) {
    return this.eventsService.isRegistered(eventId, userId); // Appel au service
  }

  @Post(':eventId/join')
  async joinEvent(
    @Param('eventId') eventId: number,
    @Body('userId') userId: number
  ) {
    try {
      const event = await this.eventsService.joinEvent(eventId, userId);
      return { message: 'Inscription réussie.', event };
    } catch (error) {
      throw new BadRequestException(
        `Erreur lors de l'inscription à l'événement : ${error.message}`
      );
    }
  }

  // RÉCUPÈRE LES DÉTAILS D'UN ÉVÉNEMENT PAR SON ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(+id);
  }

  // MET À JOUR LES INFORMATIONS D'UN ÉVÉNEMENT
  @Put(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(+id, updateEventDto);
  }

  // INVITE UN UTILISATEUR À UN ÉVÉNEMENT
  @Post(':id/invite')
  async inviteUser(
    @Param('id') eventId: string,
    @Body() body: { userId: number }
  ) {
    if (!body.userId) {
      throw new BadRequestException(
        "L'ID de l'utilisateur est requis pour l'invitation"
      );
    }
    const id = parseInt(eventId, 10);
    return this.eventsService.inviteUser(id, body.userId);
  }

  // RÉPOND À UNE INVITATION POUR UN ÉVÉNEMENT
  @Post(':id/rsvp')
  async rsvpToEvent(
    @Param('id') eventId: string,
    @Body() body: { userId: number; status: string }
  ) {
    if (!body.userId || !body.status) {
      throw new BadRequestException(
        "L'ID de l'utilisateur et le statut sont requis pour le RSVP"
      );
    }
    const id = parseInt(eventId, 10);
    return this.eventsService.rsvpToEvent(id, body.userId, body.status);
  }

  // SUPPRIME UN ÉVÉNEMENT
// events.controller.ts
@Delete(':id')
remove(@Param('id') id: number, @Query('userId') userId: number) {
  return this.eventsService.remove(id, userId);
}

  @Delete(':eventId/leave')
  async leaveEvent(
    @Param('eventId') eventId: number,
    @Body('userId') userId: number
  ) {
    try {
      const result = await this.eventsService.leaveEvent(eventId, userId);
      return { message: 'Désinscription réussie.', result };
    } catch (error) {
      throw new BadRequestException(
        `Erreur lors de la désinscription de l'événement : ${error.message}`
      );
    }
  }
}
