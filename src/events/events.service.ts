import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { S3Service } from '../services/s3/s3.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private notificationService: NotificationService
  ) {}

  // events.service.ts
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
      'Latitude, longitude, and organizerId must be valid numbers'
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
    include: {
      photos: true, // Inclut les photos dans la réponse
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

  // Récupère l'événement mis à jour avec ses photos
  const updatedEvent = await this.prisma.event.findUnique({
    where: { id: event.id },
    include: { photos: true }, // Inclut les photos associées
  });

  return updatedEvent;
}

  async findEventsByDate(date: string) {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1); // Le jour suivant

    return this.prisma.event.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        photos: true, // Inclure les photos si nécessaire
      },
    });
  }

  async findAll(userId?: string) {
    const filter = userId ? { organizerId: parseInt(userId) } : {};

    return this.prisma.event.findMany({
      where: filter,
      select: {
        id: true,
        title: true,
        description: true,
        date: true,
        location: true,
        latitude: true,
        longitude: true,
        photos: true,
        createdAt: true,
        updatedAt: true,
        organizerId: true,
        attendees: {
          select: {
            userId: true,
            status: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                photos: {
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async joinEvent(eventId: number, userId: number) {
    // Vérifier si l'événement existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Événement non trouvé.');
    }

    // Vérifier si l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé.');
    }

    // Vérifier si l'utilisateur est déjà inscrit
    const existingAttendee = await this.prisma.attendee.findFirst({
      where: {
        eventId,
        userId,
      },
    });
    if (existingAttendee) {
      throw new BadRequestException(
        'Utilisateur déjà inscrit à cet événement.'
      );
    }

    // Inscrire l'utilisateur
    await this.prisma.attendee.create({
      data: {
        eventId,
        userId,
        status: 'confirmed', // Exemple de statut par défaut
      },
    });

    // Retourner l'événement avec les participants mis à jour
    return this.findOne(eventId);
  }

  // Backend: Ajouter les participants avec leurs informations
  async findOne(eventId: number) {
    return this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        photos: true,
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                useFullName: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
        organizer: {
          // Ajout des informations de l'organisateur
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            useFullName: true,
          },
        },
      },
    });
  }

  // MET À JOUR LES INFORMATIONS D'UN ÉVÉNEMENT
  async update(id: number, data: UpdateEventDto) {
    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  async isRegistered(eventId: number, userId: number) {
    const attendee = await this.prisma.attendee.findFirst({
      where: {
        eventId,
        userId,
      },
    });

    return { isRegistered: !!attendee };
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
      userId, // ID de l'utilisateur qui reçoit la notification
      message, // Le message de notification
      'event', // Le type de notification (ici "event")
      eventId // L'ID de l'événement pour lequel la notification est envoyée
    );

    return invite;
  }

  // RÉPOND À UNE INVITATION (ACCEPTE OU REFUSE)
  async rsvpToEvent(eventId: number, userId: number, status: string) {
    const result = await this.prisma.invite.updateMany({
      where: { eventId, userId },
      data: { status },
    });

    if (result.count === 0)
      throw new NotFoundException('Invitation non trouvée');

    if (status === 'accepted') {
      await this.prisma.attendee.create({
        data: { eventId: eventId, userId: userId, status: 'accepted' },
      });
    }

    // Récupère l'ID de l'organisateur
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) throw new NotFoundException('Événement non trouvé');

    // Envoie une notification à l'organisateur pour l'informer de la réponse
    const message = `L'utilisateur (ID : ${userId}) a ${status === 'accepted' ? 'accepté' : 'refusé'} l'invitation pour l'événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      event.organizerId, // ID de l'organisateur de l'événement
      message, // Message indiquant si l'utilisateur a accepté ou refusé l'invitation
      'event', // Le type de notification ("event" pour un événement)
      eventId // L'ID de l'événement pour lequel la notification est envoyée
    );

    return { message: "Statut de l'invitation mis à jour avec succès" };
  }

  // SUPPRIME UN ÉVÉNEMENT
  async remove(eventId: number, userId: number) {
    // Récupère l'événement avec son nom et l'organisateur
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, organizerId: true }, // Inclut le titre de l'événement
    });

    if (!event || !event.title) {
      throw new NotFoundException(
        "L'événement n'existe pas ou son nom est introuvable"
      );
    }

    if (event.organizerId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à supprimer cet événement"
      );
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
    const message = `L'événement "${event.title}" a été annulé.`; // Utilise le nom de l'événement
    for (const invite of invites) {
      await this.notificationService.createNotification(
        invite.userId, // userId de l'invité
        message, // message de notification
        'event', // type de notification
        event.id // relatedId (ID de l'événement)
      );
    }

    // Correction pour les participants
    for (const attendee of attendees) {
      await this.notificationService.createNotification(
        attendee.userId, // userId du participant
        message, // message de notification
        'event', // type de notification
        event.id // relatedId (ID de l'événement)
      );
    }

    return deletedEvent;
  }

  async leaveEvent(eventId: number, userId: number) {
    // Vérifie si l'utilisateur est inscrit
    const attendee = await this.prisma.attendee.findFirst({
      where: { eventId, userId },
    });

    if (!attendee) {
      throw new BadRequestException(
        "L'utilisateur n'est pas inscrit à cet événement."
      );
    }

    // Supprime l'inscription
    return this.prisma.attendee.delete({
      where: { id: attendee.id },
    });
  }
}
