import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
    constructor(private prisma: PrismaService) { }

    // CRÉER UNE NOUVELLE PUBLICATION
    async createPost(createPostDto: CreatePostDto) {
        return this.prisma.post.create({ data: createPostDto });
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
        // Vérifie si l'utilisateur a déjà liké cette publication
        const existingLike = await this.prisma.like.findFirst({
            where: { postId, userId },
        });

        if (existingLike) {
            // Si un like existe, le supprimer (unlike)
            await this.prisma.like.delete({
                where: { id: existingLike.id },
            });
            return { message: 'Vous venez de déliker' };
        } else {
            // Si aucun like n'existe, en créer un (like)
            await this.prisma.like.create({
                data: {
                    postId,
                    userId,
                },
            });
            return { message: 'Bravo vous avez liké' };
        }
    }

    // SUPPRIME UNE PUBLICATION
    async deletePost(id: number) {
        return this.prisma.post.delete({ where: { id } });
    }
}
