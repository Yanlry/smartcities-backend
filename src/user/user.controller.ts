// Chemin : backend/src/user/user.controller.ts

import {
  Controller,
  Patch,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  NotFoundException,
  HttpStatus,
  ParseIntPipe
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/services/s3/s3.service';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { Request } from '@nestjs/common';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService
  ) {}

  // ========================================
  // ROUTES GÉNÉRALES (sans paramètres)
  // ========================================

  // LISTE LES UTILISATEURS AVEC DES FILTRES OPTIONNELS
  @Get()
  async listUsers(@Query() filters: any) {
    return this.userService.listUsers(filters);
  }

  @Get('all-rankings')
  async getAllUserRankings() {
    return this.userService.listAllUsersByRanking();
  }

  @Get('ranking-by-city')
  async getRankingByCity(
    @Query('userId') userId: number,
    @Query('cityName') cityName: string
  ) {
    if (!cityName) {
      throw new BadRequestException('Le nom de la ville est requis.');
    }
    return this.userService.getUserRanking(userId, cityName);
  }

  @Get('ranking')
  async getUserRanking(
    @Query('userId') userId: number,
    @Query('cityName') cityName: string
  ) {
    return this.userService.getUserRanking(userId, cityName);
  }

  @Get('top10')
  async getTop10ByCity(@Query('cityName') cityName: string) {
    return this.userService.listTop10Smarter(cityName);
  }

  @Put('display-preference')
  async updateDisplayPreference(
    @Body() { userId, useFullName }: { userId: number; useFullName: boolean }
  ) {
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

    return updatedUser;
  }

  @Post('show-email')
  async updateShowEmail(@Body() body: { userId: number; showEmail: boolean }) {
    return this.userService.updateEmailVisibility(body.userId, body.showEmail);
  }

  // ========================================
  // ⚠️ ROUTES SPÉCIFIQUES (AVANT :id)
  // IMPORTANT : Ces routes doivent être AVANT @Get(':id')
  // ========================================

  // ✅ RÉCUPÉRER TOUS LES COMMENTAIRES D'UN UTILISATEUR
  @Get(':userId/comments')
  async getUserComments(@Param('userId', ParseIntPipe) userId: number) {
    return await this.userService.getUserComments(userId);
  }

  // ✅ NOUVEAU : RÉCUPÉRER TOUS LES VOTES D'UN UTILISATEUR
  @Get(':userId/votes')
  async getUserVotes(@Param('userId', ParseIntPipe) userId: number) {
    console.log(`📊 Route appelée : GET /users/${userId}/votes`);
    return await this.userService.getUserVotes(userId);
  }

  // RÉCUPÉRER LES STATISTIQUES D'UN UTILISATEUR
  @Get('stats/:userId')
  async getUserStats(@Param('userId', ParseIntPipe) userId: number) {
    return await this.userService.getUserStats(userId);
  }

  // METTRE À JOUR LA PHOTO DE PROFIL
  @Post(':userId/profile-image')
  @UseInterceptors(
    FilesInterceptor('profileImage', 1, {
      limits: { fileSize: 15 * 1024 * 1024 },
    })
  )
  async updateProfileImage(
    @Param('userId', ParseIntPipe) userId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: Request
  ) {
    console.log('Requête reçue - Headers :', req.headers);
    console.log('Requête reçue - Content-Type :', req.headers['content-type']);
    console.log('Requête reçue - Body brut :', req.body);

    if (!files || files.length === 0) {
      console.log('Middleware Multer appelé, mais aucun fichier reçu');
      throw new BadRequestException('Aucune photo reçue.');
    }

    console.log('Fichiers reçus :', files);

    try {
      const newPhoto = files[0];
      const updatedPhotoUrl = await this.userService.updateProfilePhoto(
        userId,
        newPhoto
      );
      console.log(
        'Mise à jour réussie - URL de la nouvelle photo :',
        updatedPhotoUrl
      );
      return {
        message: 'Photo de profil mise à jour avec succès',
        url: updatedPhotoUrl,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour de la photo de profil :',
        error
      );
      throw new HttpException('Erreur interne', 500);
    }
  }

  // SUIVRE UN UTILISATEUR
  @Post(':id/follow')
  async followUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body('followerId') followerId: number
  ) {
    try {
      const follow = await this.userService.followUser(userId, followerId);

      return {
        success: true,
        message: 'Utilisateur suivi avec succès.',
        data: follow,
      };
    } catch (error) {
      console.error("Erreur lors du suivi de l'utilisateur :", error.message);

      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      }

      throw new HttpException(
        "Une erreur interne s'est produite lors du suivi.",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // NE PLUS SUIVRE UN UTILISATEUR
  @Delete(':id/unfollow')
  async unfollowUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body('followerId') followerId: number
  ) {
    return this.userService.unfollowUser(userId, followerId);
  }

  // CHANGER LE MOT DE PASSE
  @Put(':id/change-password')
  async changePassword(
    @Param('id', ParseIntPipe) userId: number,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.userService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword
    );
  }

  // ========================================
  // ROUTES GÉNÉRIQUES (AVEC :id)
  // ⚠️ IMPORTANT : Toujours mettre à la fin !
  // ========================================

  // RÉCUPÈRE LE PROFIL D'UN UTILISATEUR PAR SON ID
  @Get(':id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserById(id);
  }

  // METTRE À JOUR UN UTILISATEUR
  @Put(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserData: UpdateUserDto
  ) {
    const updatedUser = await this.userService.updateUser(id, updateUserData);
    return { message: 'Profil mis à jour avec succès', user: updatedUser };
  }

  // SUPPRIME LE PROFIL DE L'UTILISATEUR
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUser(id);
  }
}