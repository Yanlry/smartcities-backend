import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  // CRÉER UNE NOUVELLE PUBLICATION
  async createPost(createPostDto: CreatePostDto) {
    const post = await this.prisma.post.create({ data: createPostDto });

    // Notifier les abonnés de l'auteur de la publication
    const followers = await this.prisma.user.findMany({
      where: {
        following: {
          some: { id: createPostDto.authorId }, // Vérifie que l'utilisateur suit l'auteur
        },
      },
      select: { id: true },
    });

    const notificationMessage = `Nouvelle publication de l'utilisateur ID ${createPostDto.authorId}`;
    for (const follower of followers) {
      await this.notificationService.createNotification(follower.id, notificationMessage);
    }

    return post;
  }

  // RÉCUPÈRE UNE LISTE DE PUBLICATIONS AVEC LE NOMBRE DE LIKES
  async listPosts(filters: any) {
    const posts = await this.prisma.post.findMany({
      where: filters,
      include: {
        likes: true, // Inclut les likes pour chaque publication
      },
    });

    // Formate chaque publication pour inclure le nombre de likes
    return posts.map(post => ({
      ...post,
      likesCount: post.likes.length, // Compte le nombre de likes
    }));
  }

  // RÉCUPÈRE UNE PUBLICATION PAR SON ID AVEC LE NOMBRE DE LIKES
  async getPostById(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        _count: {
          select: { likes: true }, // Compte le nombre de likes
        },
      },
    });

    if (!post) throw new NotFoundException('Publication non trouvée');

    // Retourne la publication avec le nombre de likes
    return {
      ...post,
      likesCount: post._count.likes, // Ajoute le nombre de likes au résultat
    };
  }

  // MODIFIER UNE PUBLICATION
  async updatePost(id: number, updatePostDto: UpdatePostDto) {
    return this.prisma.post.update({
      where: { id },
      data: updatePostDto,
    });
  }

  // AJOUTE OU SUPPRIME UN LIKE POUR UNE PUBLICATION AVEC MESSAGE
  async toggleLike(postId: number, userId: number) {
    const existingLike = await this.prisma.like.findFirst({
      where: { postId, userId },
    });

    if (existingLike) {
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });
      return { message: 'Vous venez de déliker' };
    } else {
      const like = await this.prisma.like.create({
        data: {
          postId,
          userId,
        },
      });

      // Récupère l'auteur de la publication pour lui envoyer une notification
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });

      if (post?.authorId) {
        const notificationMessage = `Votre publication a été aimée par l'utilisateur ID ${userId}`;
        await this.notificationService.createNotification(post.authorId, notificationMessage);
      }

      return { message: 'Bravo vous avez liké' };
    }
  }

  // SUPPRIME UNE PUBLICATION
  async deletePost(id: number) {
    return this.prisma.post.delete({ where: { id } });
  }
}
