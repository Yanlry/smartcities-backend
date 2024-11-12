import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

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
        trustRate: true,
        latitude: true,   // Inclure latitude
        longitude: true, 
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

  // MET A JOUR LE TAUX DE CONFIANCE DE L'UTILISATEUR
  async updateUserTrustRate(userId: number) {
    const votes = await this.prisma.vote.findMany({
      where: { userId },
    });

    let trustRate = 0;
    let validVotes = 0;

    // Calcul du trustRate basé sur les votes positifs
    votes.forEach(vote => {
      if (vote.type === 'up') {
        trustRate += 1;
        validVotes += 1;
      } else if (vote.type === 'down') {
        trustRate -= 1;
      }
    });

    // Appliquer la réputation (trustRate) à l'utilisateur
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustRate: validVotes > 0 ? trustRate / validVotes : 0, // Moyenne des votes valides
      },
    });
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

  // RÉCUPÈRE LES STATISTIQUES D'UN UTILISATEUR (INCLUANT LE TRUST RATE)
  async getUserStats(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        reports: true,
        trustRate: true,  // Inclure le trustRate dans les statistiques
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      numberOfReports: user.reports.length,  // Compte les signalements
      trustRate: user.trustRate,  // Récupère le trustRate
    };
  }

  // S'ABONNER A UN UTILISATEUR 
  async followUser(userId: number, followerId: number) {
    const follow = await this.prisma.userFollow.create({
      data: {
        followingId: userId,
        followerId: followerId,
      },
    });
    // Créer une notification pour informer l'utilisateur qu'il a un nouveau follower
    const follower = await this.prisma.user.findUnique({ where: { id: followerId } });
    
    // Ajoutez ici les valeurs des arguments `type` et `relatedId`
    await this.notificationService.createNotification(
      userId, 
      `${follower.name} vous suit maintenant.`,
      "FOLLOW",           // Exemple de valeur pour le type
      follow.id           // Par exemple, l'ID du suivi
    );
    return follow;
  }

  // SE DESABONNER D'UN UTILISATEUR
  async unfollowUser(userId: number, followerId: number) {
    return this.prisma.userFollow.deleteMany({
      where: {
        followingId: userId,
        followerId: followerId,
      },
    });
  }

  // RECUPERE LE NOMBRE DE FOLLOWER D'UN UTILISATEUR
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

  // SUPPRIME UN UTILISATEUR PAR SON ID
  async deleteUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Utilisateur supprimé avec succès' };
  }
}
