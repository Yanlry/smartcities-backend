import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  async getUserWithFollowers(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { followers: true }, // Compte les followers
        },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      ...user,
      followersCount: user._count.followers, // Ajoute le nombre de followers au résultat
    };
  }

  async followUser(userId: number, followerId: number) {
    const follow = await this.prisma.userFollow.create({
      data: {
        followingId: userId,
        followerId: followerId,
      },
    });
    // Créer une notification pour informer l'utilisateur qu'il a un nouveau follower
    const follower = await this.prisma.user.findUnique({ where: { id: followerId } });
    await this.notificationService.createNotification(userId, `${follower.name} vous suit maintenant.`);
    return follow;
  }


  // Se désabonner d'un utilisateur
  async unfollowUser(userId: number, followerId: number) {
    return this.prisma.userFollow.deleteMany({
      where: {
        followingId: userId,
        followerId: followerId,
      },
    });
  }

  // RÉCUPÈRE LE PROFIL COMPLET D'UN UTILISATEUR PAR SON ID
  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        reports: true, // RÉCUPÈRE LE NOMBRE DE SIGNALEMENTS
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  // MET À JOUR LE PROFIL D'UN UTILISATEUR
  async updateUser(userId: number, data: any) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return updatedUser;
  }

  // LISTE LES UTILISATEURS AVEC POSSIBILITÉ DE FILTRE
  async listUsers(filter: any) {
    const users = await this.prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        reports: true,
      },
    });
    return users;
  }

  // RÉCUPÈRE LES STATISTIQUES D'UN UTILISATEUR (EX. NOMBRE DE SIGNALEMENTS)
  async getUserStats(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        reports: true,
        // AJOUTEZ D'AUTRES CHAMPS POUR LES STATISTIQUES
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return {
      numberOfReports: user.reports, // UTILISE LE CHAMP reports POUR LES STATISTIQUES
    };
  }

  // SUPPRIME UN UTILISATEUR PAR SON ID
  async deleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Utilisateur supprimé avec succès' };
  }
}
