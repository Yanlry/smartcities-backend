import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  Logger,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { S3Service } from '../services/s3/s3.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly s3Service: S3Service
  ) {}

  private readonly logger = new Logger(PostsController.name);

  @Post()
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() photos: Express.Multer.File[]
  ) {
    this.logger.log('Creating post...');
    this.logger.debug('Received Body:', createPostDto);
    this.logger.debug('Received Files:', photos);

    const validPhotos = photos.filter(
      (file) => file.buffer && file.originalname && file.mimetype
    );

    this.logger.debug('Valid Files:', validPhotos);

    const photoUrls = [];
    for (const photo of validPhotos) {
      try {
        this.logger.debug('Uploading valid file:', {
          name: photo.originalname,
          mimetype: photo.mimetype,
          size: photo.size,
        });
        const url = await this.s3Service.uploadFile(photo);
        photoUrls.push(url);
      } catch (error) {
        this.logger.error(
          `Erreur lors de l'upload du fichier ${photo.originalname}:`,
          error.message
        );
        throw new BadRequestException(
          `Erreur lors de l'upload de la photo ${photo.originalname}: ${error.message}`
        );
      }
    }

    this.logger.debug('All uploaded photo URLs:', photoUrls);

    try {
      const post = await this.postsService.createPost(createPostDto, photoUrls);
      this.logger.log('Post created successfully:', post);
      return post;
    } catch (error) {
      this.logger.error('Error creating post:', error.message);
      throw new BadRequestException(
        `Erreur lors de la création du post : ${error.message}`
      );
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listPosts(@Query() filters: any, @Req() req: any) {
    const user = req.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const cityName = filters.cityName
      ? filters.cityName.toUpperCase()
      : undefined;

    return this.postsService.listPosts(filters, user.id, cityName);
  }

  // posts.controller.ts
@Get('author/:authorId')
async listPostsByAuthor(
  @Param('authorId', ParseIntPipe) authorId: number,
  @Query() filters: any
) {
  const cityName = filters.cityName ? filters.cityName.toUpperCase() : undefined;
  return this.postsService.listPostsByAuthor(filters, authorId, cityName);
}

  // RÉCUPÈRE LES DÉTAILS D'UNE PUBLICATION SPÉCIFIQUE
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPostById(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    if (!user || !user.id) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    return this.postsService.getPostById(Number(id), user.id);
  }

  // MODIFIER UNE PUBLICATION
  @Put(':id')
  async updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto
  ) {
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

  @Post('comments/:commentId/like')  
  async toggleLikeComment(
    @Param('commentId') commentId: number,
    @Body() body: { userId: number }
  ) {
    return this.postsService.toggleLikeComment(commentId, body.userId);
  }

  @Delete(':id')
  async deletePost(@Param('id') id: string) {
    try {
      return this.postsService.deletePost(Number(id));
    } catch (error) {
      console.error('Erreur API :', error.message);
      throw new HttpException(
        'Erreur interne lors de la suppression',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // SUPPRIME UN COMMENTAIRE
  @Delete('comments/:id')
  async deleteCommentById(@Param('id', ParseIntPipe) id: number) {
    try {
      return this.postsService.deleteComment(id);
    } catch (error) {
      console.error('Erreur API :', error.message);
      throw new HttpException(
        'Erreur lors de la suppression du commentaire',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // AJOUTE UN COMMENTAIRE
  @Post('comment')
  async commentOnPost(
    @Body() commentData: { postId: number; userId: number; text: string }
  ) {
    return this.postsService.commentOnPost(commentData);
  }
}
