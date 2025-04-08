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

  async create(data: CreateEventDto, photoUrls: string[]) {
    console.log('Photo URLs received in create service:', photoUrls);

    if (!photoUrls || photoUrls.length === 0) {
      throw new BadRequestException('No valid photo URLs provided');
    }

    const latitude = parseFloat(data.latitude.toString());
    const longitude = parseFloat(data.longitude.toString());
    const organizerId = parseInt(data.organizerId.toString(), 10);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(organizerId)) {
      throw new BadRequestException(
        'Latitude, longitude, and organizerId must be valid numbers'
      );
    }

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
        photos: true,
      },
    });

    console.log('Event created in database:', event);

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

    const updatedEvent = await this.prisma.event.findUnique({
      where: { id: event.id },
      include: { photos: true },
    });

    return updatedEvent;
  }

  async findEventsByDate(date: string) {
    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    return this.prisma.event.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        photos: true,
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
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Événement non trouvé.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé.');
    }

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

    await this.prisma.attendee.create({
      data: {
        eventId,
        userId,
        status: 'confirmed',
      },
    });

    return this.findOne(eventId);
  }

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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            useFullName: true,
            photos: { // Ajout de cette partie
              where: { isProfile: true },
              select: { url: true },
            },
          },
        },
      },
    });
  }

  async update(id: number, data: UpdateEventDto) {
    const { photos, ...filteredData } = data;

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: {
        ...filteredData,
        photos: photos
          ? {
              deleteMany: {},
              create: photos.map((photo) => ({
                url: photo.url,
              })),
            }
          : undefined,
      },
    });

    return updatedEvent;
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

  async inviteUser(eventId: number, userId: number) {
    const invite = await this.prisma.invite.create({
      data: {
        eventId: eventId,
        userId: userId,
        status: 'pending',
      },
    });

    const message = `Vous avez été invité à un événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      userId,
      message,
      'event',
      eventId
    );

    return invite;
  }

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

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) throw new NotFoundException('Événement non trouvé');

    const message = `L'utilisateur (ID : ${userId}) a ${status === 'accepted' ? 'accepté' : 'refusé'} l'invitation pour l'événement (ID : ${eventId})`;
    await this.notificationService.createNotification(
      event.organizerId,
      message,
      'event',
      eventId
    );

    return { message: "Statut de l'invitation mis à jour avec succès" };
  }

  async remove(eventId: number, userId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        organizerId: true,
        organizer: {
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

    const organizerName = event.organizer.useFullName
      ? `${event.organizer.firstName} ${event.organizer.lastName}`
      : event.organizer.username || 'Un utilisateur';

    const organizerPhoto =
      event.organizer.photos?.[0]?.url || 'Aucune photo disponible';

    const message = `L'événement "${event.title}" organisé par ${organizerName} a été annulé.`;
    for (const invite of invites) {
      await this.notificationService.createNotification(
        invite.userId,
        message,
        'event',
        event.id,
        userId
      );
    }

    for (const attendee of attendees) {
      await this.notificationService.createNotification(
        attendee.userId,
        message,
        'event',
        event.id,
        userId
      );
    }

    return deletedEvent;
  }

  async leaveEvent(eventId: number, userId: number) {
    // Vérifier si l'utilisateur est l'organisateur
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
    
    if (!event) {
      throw new NotFoundException('Événement non trouvé.');
    }
    
    // Empêcher l'organisateur de se désinscrire
    if (event.organizerId === userId) {
      throw new ForbiddenException('L\'organisateur ne peut pas se désinscrire de son propre événement.');
    }
  
    const attendee = await this.prisma.attendee.findFirst({
      where: { eventId, userId },
    });
  
    if (!attendee) {
      throw new BadRequestException(
        "L'utilisateur n'est pas inscrit à cet événement."
      );
    }
  
    return this.prisma.attendee.delete({
      where: { id: attendee.id },
    });
  }
}
