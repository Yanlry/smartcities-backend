import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) {}

  async listGroups() {
    return this.prisma.group.findMany();
  }

  async createGroup(data: CreateGroupDto, ownerId: number) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });
    if (!owner) {
      throw new NotFoundException('Utilisateur propriétaire non trouvé');
    }

    return this.prisma.group.create({
      data: {
        ...data,
        ownerId,
      },
    });
  }

  async getGroupById(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
    });
    if (!group) throw new NotFoundException('Groupe non trouvé');
    return group;
  }

  async joinGroup(groupId: number, userId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Groupe non trouvé');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups: {
          connect: { id: groupId },
        },
      },
    });

    const message = `Un nouvel utilisateur (ID : ${userId}) a rejoint votre groupe (ID : ${groupId})`;
    await this.notificationService.createNotification(
      group.ownerId,
      message,
      'group',
      groupId
    );

    return { message: 'Vous avez rejoint le groupe avec succès' };
  }

  async leaveGroup(groupId: number, userId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    const isMember = group.members.some((member) => member.id === userId);
    if (!isMember) {
      throw new NotFoundException("L'utilisateur n'est pas membre du groupe");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        groups: {
          disconnect: { id: groupId },
        },
      },
    });

    const message = `L'utilisateur (ID : ${userId}) a quitté votre groupe (ID : ${groupId})`;
    await this.notificationService.createNotification(
      group.ownerId,
      message,
      'group',
      groupId
    );

    return { message: 'Utilisateur retiré du groupe avec succès' };
  }

  async getGroupMembers(groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) throw new NotFoundException('Groupe non trouvé');
    return group.members;
  }

  async deleteGroup(groupId: number, ownerId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Groupe non trouvé');
    }

    if (group.ownerId !== ownerId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à supprimer ce groupe"
      );
    }

    const message = `Le groupe (ID : ${groupId}) auquel vous apparteniez a été supprimé.`;
    for (const member of group.members) {
      await this.notificationService.createNotification(
        member.id,
        message,
        'group',
        groupId
      );
    }

    return this.prisma.group.delete({ where: { id: groupId } });
  }
}
