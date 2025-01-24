import {
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { S3Service } from 'src/services/s3/s3.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly s3Service: S3Service
  ) {}

  async listTop10Smarter(cityName: string) {
    if (!cityName) {
      throw new BadRequestException('Le nom de la ville est requis.');
    }

    const users = await this.prisma.user.findMany({
      where: {
        nomCommune: cityName,
      },
      include: {
        votes: true,
        photos: {
          where: { isProfile: true },
          select: { url: true },
        },
      },
    });

    const usersWithRanking = users
      .map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        useFullName: user.useFullName,
        voteCount: user.votes.length,
        photo: user.photos[0]?.url || null,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    const usersWithRankingAndPosition = usersWithRanking.map((user, index) => ({
      ...user,
      ranking: index + 1,
    }));

    return usersWithRankingAndPosition.slice(0, 10);
  }

  async listAllUsersByRanking() {
    const users = await this.prisma.user.findMany({
      include: {
        votes: true,
        photos: {
          where: { isProfile: true },
          select: { url: true },
        },
      },
    });

    const usersWithRanking = users
      .map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        useFullName: user.useFullName,
        voteCount: user.votes.length,
        photo: user.photos[0]?.url || null,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    return usersWithRanking.map((user, index) => ({
      ...user,
      ranking: index + 1,
    }));
  }

  // LISTE LES UTILISATEURS AVEC POSSIBILITÉ DE FILTRE
  async listUsers(filter: any) {
    const users = await this.prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        email: true,
        username: true,
        lastName: true,
        firstName: true,
        createdAt: true,
        reports: true,
      },
    });
    return users;
  }

  // METTRE À JOUR LA PREFERENCE D'AFFICHAGE DE L'UTILISATEUR
  async updateDisplayPreference(userId: number, useFullName: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { useFullName },
    });

    return {
      message: 'Préférence mise à jour avec succès',
      user: {
        id: updatedUser.id,
        useFullName: updatedUser.useFullName,
      },
    };
  }

  async getUserRanking(userId: number, cityName: string) {
    const users = await this.prisma.user.findMany({
      where: {
        nomCommune: cityName,
      },
      include: {
        votes: true,
        photos: {
          where: { isProfile: true },
          select: { url: true },
        },
      },
    });

    const usersWithVoteCount = users.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      useFullName: user.useFullName,
      voteCount: user.votes.length,
      photo: user.photos[0]?.url || null,
    }));

    usersWithVoteCount.sort((a, b) => b.voteCount - a.voteCount);

    const ranking =
      usersWithVoteCount.findIndex((user) => user.id === userId) + 1;

    return {
      ranking,
      totalUsers: usersWithVoteCount.length,
      users: usersWithVoteCount.map((user, index) => ({
        ...user,
        ranking: index + 1,
      })),
    };
  }

  async getUserById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        showEmail: true,
        username: true,
        lastName: true,
        firstName: true,
        useFullName: true,
        createdAt: true,
        trustRate: true,
        nomCommune: true,
        codePostal: true,
        latitude: true,
        longitude: true,
        photos: {
          where: { isProfile: true },
          select: {
            id: true,
            url: true,
          },
        },
        followers: {
          select: {
            follower: {
              select: {
                id: true,
                username: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
        following: {
          select: {
            following: {
              select: {
                id: true,
                username: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const usersInCity = await this.prisma.user.findMany({
      where: { nomCommune: user.nomCommune },
      include: {
        votes: true,
      },
    });

    const usersWithVoteCount = usersInCity.map((u) => ({
      id: u.id,
      voteCount: u.votes.length,
    }));

    usersWithVoteCount.sort((a, b) => b.voteCount - a.voteCount);

    const ranking = usersWithVoteCount.findIndex((u) => u.id === userId) + 1;

    return {
      ...user,
      email: user.showEmail ? user.email : null,
      profilePhoto: user.photos.length > 0 ? user.photos[0] : null,
      followers: user.followers.map((f) => ({
        id: f.follower.id,
        username: f.follower.username,
        profilePhoto: f.follower.photos[0]?.url || null,
      })),
      following: user.following.map((f) => ({
        id: f.following.id,
        username: f.following.username,
        profilePhoto: f.following.photos[0]?.url || null,
      })),
      ranking,
    };
  }

  async updateEmailVisibility(userId: number, showEmail: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { showEmail },
    });

    return {
      message: 'Préférence mise à jour avec succès.',
      showEmail: user.showEmail,
    };
  }

  async updateProfilePhoto(
    userId: number,
    newProfilePhoto: Express.Multer.File
  ): Promise<string> {
    const oldProfilePhoto = await this.prisma.photo.findFirst({
      where: { userId, isProfile: true },
    });

    if (oldProfilePhoto) {
      try {
        await this.s3Service.deleteFile(oldProfilePhoto.url);
        console.log(
          'Ancienne photo de profil supprimée :',
          oldProfilePhoto.url
        );
      } catch (error) {
        console.error(
          "Erreur lors de la suppression de l'ancienne photo :",
          error.message
        );
      }
    } else {
      console.log('Aucune ancienne photo à supprimer');
    }

    const newProfilePhotoUrl = await this.s3Service.uploadFile(newProfilePhoto);
    console.log('Nouvelle photo uploadée :', newProfilePhotoUrl);

    await this.prisma.photo.updateMany({
      where: { userId },
      data: { isProfile: false },
    });

    const createdPhoto = await this.prisma.photo.create({
      data: {
        url: newProfilePhotoUrl,
        isProfile: true,
        userId,
      },
    });

    return createdPhoto.url;
  }

  async updateUser(userId: number, data: UpdateUserDto) {
    const { email, username, firstName, lastName, nomCommune, codePostal } =
      data;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { email, username, firstName, lastName, nomCommune, codePostal },
    });

    return updatedUser;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new Error('Utilisateur introuvable.');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      existingUser.password
    );
    if (!isPasswordValid) {
      throw new Error('Mot de passe actuel incorrect.');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Mot de passe mis à jour avec succès.' };
  }

  async updateUserTrustRate(userId: number) {
    const votes = await this.prisma.vote.findMany({
      where: { userId },
    });

    let trustRate = 0;
    let validVotes = 0;

    votes.forEach((vote) => {
      if (vote.type === 'up') {
        trustRate += 1;
        validVotes += 1;
      } else if (vote.type === 'down') {
        trustRate -= 1;
      }
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustRate: validVotes > 0 ? trustRate / validVotes : 0,
      },
    });
  }

  async getUserStats(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        reports: true,
        votes: true,
        comments: true,
        organizedEvents: true,
        posts: true,
        attendedEvents: true,
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      numberOfReports: user.reports.length,
      trustRate: user.trustRate || 0,
      numberOfVotes: user.votes.length,
      numberOfComments: user.comments.length,
      numberOfEventsCreated: user.organizedEvents.length,
      numberOfPosts: user.posts.length,
      numberOfEventsAttended: user.attendedEvents.length,
      votes: user.votes.map((vote) => ({
        type: vote.type,
        reportId: vote.reportId,
        createdAt: vote.createdAt,
      })),
    };
  }

  async followUser(userId: number, followerId: number) {
    console.log('Vérification de la relation existante...');
    const existingFollow = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userId,
        },
      },
    });

    if (existingFollow) {
      console.log('Relation existante détectée.');
      throw new Error('Vous suivez déjà cet utilisateur.');
    }

    console.log('Création du lien de suivi...');
    const follow = await this.prisma.userFollow.create({
      data: {
        followingId: userId,
        followerId,
      },
    });

    console.log('Lien de suivi créé avec succès, ajout de la notification...');
    try {
      const follower = await this.prisma.user.findUnique({
        where: { id: followerId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          useFullName: true,
        },
      });

      if (!follower) {
        console.log("L'utilisateur qui suit n'existe pas.");
        throw new Error("L'utilisateur qui suit n'existe pas.");
      }

      const followerName = follower.useFullName
        ? `${follower.firstName} ${follower.lastName}`
        : follower.username || 'Un utilisateur';

      await this.notificationService.createNotification(
        userId,
        `${followerName} vous suit maintenant.`,
        'FOLLOW',
        follower.id,
        follower.id
      );
      console.log('Notification créée avec succès.');
    } catch (error) {
      console.error(
        'Erreur lors de la création de la notification :',
        error.message
      );
    }

    console.log('Retour de la réponse...');
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
          select: { followers: true },
        },
      },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    return {
      ...user,
      followersCount: user._count.followers,
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
