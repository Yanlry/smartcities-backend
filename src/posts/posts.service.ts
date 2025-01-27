import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NotificationService } from '../notification/notification.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
  ) {}

  // CRÉER UNE NOUVELLE PUBLICATION
  async createPost(createPostDto: CreatePostDto, photoUrls: string[]) {
    const post = await this.prisma.post.create({
      data: {
        content: createPostDto.content,
        latitude: createPostDto.latitude,
        longitude: createPostDto.longitude,
        author: {
          connect: { id: createPostDto.authorId },
        },
      },
    });
    if (photoUrls && photoUrls.length > 0) {
      const photosData = photoUrls.map((url) => ({
        url,
        postId: post.id,
      }));

      try {
        await this.prisma.photo.createMany({
          data: photosData,
        });
      } catch (error) {
        console.error(
          'Erreur lors de l’association des photos au post:',
          error
        );
        throw new BadRequestException(
          'Erreur lors de l’association des photos.'
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: createPostDto.authorId },
      select: {
        nomCommune: true,
        firstName: true,
        lastName: true,
        username: true,
        useFullName: true,
      },
    });

    const updatedPost = await this.prisma.post.findUnique({
      where: { id: post.id },
      include: { photos: true },
    });

    return {
      ...updatedPost,
      authorName: user.useFullName
        ? `${user.firstName} ${user.lastName}`
        : user.username || 'Utilisateur inconnu',
      nomCommune: user.nomCommune,
    };
  }

  async listPosts(filters: any, userId: number, cityName?: string) {
    const whereClause: Prisma.PostWhereInput = cityName
      ? {
          author: {
            nomCommune: {
              equals: cityName,
              mode: 'insensitive',
            },
          },
        }
      : {};

    const posts = await this.prisma.post.findMany({
      where: whereClause,
      include: {
        likes: true,
        photos: { select: { url: true } },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                useFullName: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            nomCommune: true,
            photos: {
              where: { isProfile: true },
              select: { url: true },
            },
          },
        },
      },
    });

    return posts.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likesCount: post.likes.length,
      likedByUser: post.likes.some((like) => like.userId === userId),
      authorId: post.author.id,
      authorName: post.author.useFullName
        ? `${post.author.firstName} ${post.author.lastName}`
        : post.author.username || 'Utilisateur inconnu',
      profilePhoto: post.author.photos[0]?.url || null,
      nomCommune: post.author.nomCommune || 'Ville inconnue',
      photos: post.photos.map((photo) => photo.url),
      comments: post.comments.map((comment) => ({
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        parentId: comment.parentId || null,
        userId: comment.user?.id || null,
        userName: comment.user
          ? comment.user.useFullName
            ? `${comment.user.firstName} ${comment.user.lastName}`
            : comment.user.username || 'Utilisateur inconnu'
          : 'Utilisateur inconnu',
        userProfilePhoto: comment.user?.photos[0]?.url || null,
      })),
    }));
  }

  // RÉCUPÈRE UNE PUBLICATION PAR SON ID AVEC LE NOMBRE DE LIKES ET LES PHOTOS ASSOCIÉES
  async getPostById(id: number, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        likes: true,
        photos: {
          select: { url: true },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                useFullName: true,
                photos: {
                  where: { isProfile: true },
                  select: { url: true },
                },
              },
            },
          },
        },
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            useFullName: true,
            photos: {
              where: { isProfile: true },
              select: { url: true },
            },
          },
        },
        _count: {
          select: { likes: true },
        },
      },
    });

    if (!post) throw new NotFoundException('Publication non trouvée');

    const organizeComments = (comments) => {
      const commentMap = new Map();

      comments.forEach((comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });

      const rootComments = [];

      comments.forEach((comment) => {
        if (comment.parentId) {
          const parentComment = commentMap.get(comment.parentId);
          if (parentComment) {
            parentComment.replies.push(commentMap.get(comment.id));
          }
        } else {
          rootComments.push(commentMap.get(comment.id));
        }
      });

      return rootComments;
    };

    const likedByUser = post.likes.some((like) => like.userId === userId);

    return {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likesCount: post._count.likes,
      likedByUser,
      authorId: post.author.id,
      authorName: post.author.useFullName
        ? `${post.author.firstName} ${post.author.lastName}`
        : post.author.username || 'Utilisateur inconnu',
      profilePhoto: post.author.photos[0]?.url || null,
      photos: post.photos.map((photo) => photo.url),
      comments: organizeComments(
        post.comments.map((comment) => ({
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt,
          parentId: comment.parentId || null,
          userId: comment.user?.id || null,
          userName: comment.user
            ? comment.user.useFullName
              ? `${comment.user.firstName} ${comment.user.lastName}`
              : comment.user.username || 'Utilisateur inconnu'
            : 'Utilisateur inconnu',
          userProfilePhoto: comment.user?.photos[0]?.url || null,
        }))
      ),
    };
  }

  // MODIFIER UNE PUBLICATION
  async updatePost(id: number, updatePostDto: UpdatePostDto) {
    return this.prisma.post.update({
      where: { id },
      data: updatePostDto,
    });
  }

  async toggleLike(postId: number, userId: number) {
    const existingLike = await this.prisma.like.findFirst({
      where: { postId, userId },
    });

    if (existingLike) {
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });
      await this.updateUserTrustRate(userId, -1);
      return { message: 'Vous venez de déliker' };
    } else {
      const like = await this.prisma.like.create({
        data: {
          postId,
          userId,
        },
      });

      await this.updateUserTrustRate(userId, 1);

      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          useFullName: true,
        },
      });

      if (post?.authorId && user) {
        const likerName = user.useFullName
          ? `${user.firstName} ${user.lastName}`
          : user.username || 'Un utilisateur';

        const notificationMessage = `${likerName} a aimé votre publication.`;

        await this.notificationService.createNotification(
          post.authorId,
          notificationMessage,
          'LIKE',
          post.id,
          userId
        );
      }

      return { message: 'Bravo vous avez liké' };
    }
  }

  // MET À JOUR LE TRUSTRATE D'UN UTILISATEUR
  async updateUserTrustRate(userId: number, increment: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustRate: true },
    });

    if (!user) throw new BadRequestException('Utilisateur non trouvé');

    const newTrustRate = user.trustRate + increment;

    const clampedTrustRate = Math.max(-1, Math.min(newTrustRate, 1));

    await this.prisma.user.update({
      where: { id: userId },
      data: { trustRate: clampedTrustRate },
    });
  }

  async commentOnPost(commentData: CreateCommentDto) {
    const { postId, userId, text, parentId } = commentData;

    if (!postId || !userId || !text) {
      throw new BadRequestException(
        'Post ID, User ID, and Comment text are required'
      );
    }

    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });

      if (!parentComment) {
        throw new BadRequestException("Le commentaire parent n'existe pas.");
      }
    }

    console.log('Données reçues dans le backend :', commentData);

    const newComment = await this.prisma.comment.create({
      data: {
        postId,
        userId,
        text,
        parentId,
      },
    });

    await this.updateUserTrustRate(userId, 0.5);

    const commenter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        username: true,
        useFullName: true,
      },
    });

    if (!commenter) {
      console.error(`Utilisateur introuvable pour l'ID : ${userId}`);
      return newComment;
    }

    const commenterName = commenter.useFullName
      ? `${commenter.firstName} ${commenter.lastName}`
      : commenter.username || 'Un utilisateur';

    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      });

      if (parentComment && parentComment.userId !== userId) {
        const notificationMessage = `${commenterName} a répondu à votre commentaire.`;

        await this.notificationService.createNotification(
          parentComment.userId,
          notificationMessage,
          'comment_reply',
          postId,
          userId
        );
      }
    } else {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });

      if (!post) {
        console.error(`Post introuvable pour l'ID : ${postId}`);
        return newComment;
      }

      if (post.authorId !== userId) {
        const notificationMessage = `${commenterName} a commenté votre publication.`;

        await this.notificationService.createNotification(
          post.authorId,
          notificationMessage,
          'comment',
          postId,
          userId
        );
      }
    }

    return newComment;
  }

  async deleteComment(commentId: number) {
    try {
      return await this.prisma.comment.delete({
        where: { id: commentId },
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du commentaire :', error);
      throw new NotFoundException('Commentaire non trouvé');
    }
  }

  async deletePost(id: number) {
    try {
      await this.prisma.comment.deleteMany({
        where: { postId: id },
      });

      await this.prisma.like.deleteMany({
        where: { postId: id },
      });

      return await this.prisma.post.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Erreur lors de la suppression :', error);
      throw new Error('Impossible de supprimer la publication.');
    }
  }
}
