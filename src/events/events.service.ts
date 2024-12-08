import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { S3Service } from '../services/s3/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService,
    private s3Service: S3Service,
    private notificationService: NotificationService,
  ) { }

  // events.service.ts
  async create(data: CreateEventDto, photoUrls: string[]) {
    console.log('Photo URLs received in create service:', photoUrls);
  
    if (!photoUrls || photoUrls.length === 0) {
      throw new BadRequestException('No valid photo URLs provided');
    }
  
    // Conversion des coordonnées
    const latitude = parseFloat(data.latitude.toString());
    const longitude = parseFloat(data.longitude.toString());
    const organizerId = parseInt(data.organizerId.toString(), 10);
  
    if (isNaN(latitude) || isNaN(longitude) || isNaN(organizerId)) {
      throw new BadRequestException(
        'Latitude, longitude, and organizerId must be valid numbers',
      );
    }
  
    // Création de l'événement
    const event = await this.prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        date: new Date(data.date),
        location: data.location,
        latitude,
        longitude,
        organizer: { connect: { id: organizerId } },
      },
    });
  
    console.log('Event created in database:', event);
  
    // Ajout des photos à l'événement
    if (photoUrls.length > 0) {
      const photosData = photoUrls.map((url) => ({
        url,
        eventId: event.id,
      }));
  
      console.log('Photos to associate with event:', photosData);
  
      await this.prisma.photo.createMany({
        data: photosData,
      });
    }
  
    return event;
  }

  async findAll() {
    return this.prisma.event.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        location: true,
        latitude: true,
        longitude: true,
        photos: true, // Inclure le champ image
        createdAt: true,
        updatedAt: true,
        organizerId: true,
      },
    });
  }

  // RÉCUPÈRE LES DÉTAILS D'UN ÉVÉNEMENT PAR SON ID
  async findOne(id: number) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // MET À JOUR LES INFORMATIONS D'UN ÉVÉNEMENT
  async update(id: number, data: UpdateEventDto) {
    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  // INVITE UN UTILISATEUR À UN ÉVÉNEMENT
  async inviteUser(eventId: number, userId: number) {
    // Créer une invitation pour un utilisateur
    const invite = await this.prisma.invite.create({
      data: {
        eventId: eventId,
        userId: userId,
        status: 'pending', // Statut d'invitation par défaut
      },
    });

    // Notifier l'utilisateur qu'il a été invité
    const message = `Vous avez été invité à un événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      userId,          // ID de l'utilisateur qui reçoit la notification
      message,         // Le message de notification
      "event",         // Le type de notification (ici "event")
      eventId          // L'ID de l'événement pour lequel la notification est envoyée
    );
    

    return invite;
  }

  // RÉPOND À UNE INVITATION (ACCEPTE OU REFUSE)
  async rsvpToEvent(eventId: number, userId: number, status: string) {
    const result = await this.prisma.invite.updateMany({
      where: { eventId, userId },
      data: { status },
    });

    if (result.count === 0) throw new NotFoundException("Invitation non trouvée");

    if (status === "accepted") {
      await this.prisma.attendee.create({
        data: { eventId: eventId, userId: userId, status: "accepted" },
      });
    }

    // Récupère l'ID de l'organisateur
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) throw new NotFoundException("Événement non trouvé");

    // Envoie une notification à l'organisateur pour l'informer de la réponse
    const message = `L'utilisateur (ID : ${userId}) a ${status === "accepted" ? "accepté" : "refusé"} l'invitation pour l'événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      event.organizerId,  // ID de l'organisateur de l'événement
      message,            // Message indiquant si l'utilisateur a accepté ou refusé l'invitation
      "event",            // Le type de notification ("event" pour un événement)
      eventId             // L'ID de l'événement pour lequel la notification est envoyée
    );
    

    return { message: "Statut de l'invitation mis à jour avec succès" };
  }

  // SUPPRIME UN ÉVÉNEMENT
  async remove(eventId: number, userId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException("L'événement n'existe pas");
    }

    if (event.organizerId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à supprimer cet événement");
    }

    // Récupère les invités et les participants
    const attendees = await this.prisma.attendee.findMany({
      where: { eventId: eventId },
      select: { userId: true },
    });

    const invites = await this.prisma.invite.findMany({
      where: { eventId: eventId },
      select: { userId: true },
    });

    await this.prisma.attendee.deleteMany({
      where: { eventId: eventId },
    });

    await this.prisma.invite.deleteMany({
      where: { eventId: eventId },
    });

    const deletedEvent = await this.prisma.event.delete({
      where: { id: eventId },
    });

    // Notifie chaque invité et participant que l'événement a été annulé
    const message = `L'événement (ID : ${eventId}) a été annulé.`;
    // Correction pour inviter et notifier
      for (const invite of invites) {
        await this.notificationService.createNotification(
          invite.userId,  // userId de l'invité
          message,  // message de notification
          'event',  // type de notification
          event.id  // relatedId (ID de l'événement)
        );
      }

      // Correction pour les participants
      for (const attendee of attendees) {
        await this.notificationService.createNotification(
          attendee.userId,  // userId du participant
          message,  // message de notification
          'event',  // type de notification
          event.id  // relatedId (ID de l'événement)
        );
      }

    return deletedEvent;
  }
}
