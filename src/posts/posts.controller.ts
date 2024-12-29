import { Controller, Post, Get, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
    constructor(private readonly postsService: PostsService) { }

    // CRÉE UNE NOUVELLE PUBLICATION
    @Post()
    async createPost(@Body() createPostDto: CreatePostDto) {
        return this.postsService.createPost(createPostDto);
    }

    // LISTE LES PUBLICATIONS
    @Get()
    async listPosts(@Query() filters: any) {
        return this.postsService.listPosts(filters);
    }

    // RÉCUPÈRE LES DÉTAILS D'UNE PUBLICATION SPÉCIFIQUE
    @Get(':id')
    async getPostById(@Param('id') id: string) {
        return this.postsService.getPostById(Number(id));
    }

    // MODIFIER UNE PUBLICATION
    @Put(':id')
    async updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
        return this.postsService.updatePost(Number(id), updatePostDto);
    }

    // AJOUTE OU SUPPRIME UN LIKE À UNE PUBLICATION ET MET À JOUR LE TRUSTRATE
    @Post(':postId/like')
    async toggleLike(
      @Param('postId') postId: number,
      @Body('userId') userId: number
    ) {
      return this.postsService.toggleLike(postId, userId);
    }

    // SUPPRIME UNE PUBLICATION
    @Delete(':id')
    async deletePost(@Param('id') id: string) {
        return this.postsService.deletePost(Number(id));
    }

    // AJOUTE UN COMMENTAIRE ET MET À JOUR LE TRUSTRATE DE L'UTILISATEUR
    @Post('comment')
    async commentOnPost(@Body() commentData: { postId: number; userId: number; text: string }) {
      return this.postsService.commentOnPost(commentData);
    }
}
