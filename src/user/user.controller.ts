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
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Pour sécuriser l'accès avec un token JWT
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
    // Vérifie si l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Met à jour la préférence
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { useFullName },
    });

    return updatedUser; // Retourne l'utilisateur mis à jour
  }

  @Post('show-email')
  async updateShowEmail(@Body() body: { userId: number; showEmail: boolean }) {
    return this.userService.updateEmailVisibility(body.userId, body.showEmail);
  }

  // RÉCUPÈRE LE PROFIL D'UN UTILISATEUR PAR SON ID
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const userId = parseInt(id, 10); // Convertit l'ID de chaîne en nombre
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');
    return this.userService.getUserById(userId);
  }

  @Post(':userId/profile-image')
  @UseInterceptors(
    FilesInterceptor('profileImage', 1, {
      limits: { fileSize: 15 * 1024 * 1024 }, // Limite de 10 Mo
    })
  )
  async updateProfileImage(
    @Param('userId') userId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: Request // Pour inspecter les en-têtes et le corps brut si nécessaire
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

  // RECUPERER LE NOMBRE DE FOLLOWER D'UN UTILISATEUR
  @Get(':id')
  async getUserWithFollowers(@Param('id') userId: string) {
    return this.userService.getUserWithFollowers(Number(userId));
  }

  // SUIVRE UN UTILISATEUR
  @Post(':id/follow')
  async followUser(
    @Param('id') userId: string,
    @Body('followerId') followerId: number
  ) {
    try {
      // Appelle le service pour effectuer le suivi
      const follow = await this.userService.followUser(+userId, followerId);

      // Retourne une réponse de succès
      return {
        success: true,
        message: 'Utilisateur suivi avec succès.',
        data: follow,
      };
    } catch (error) {
      // Log de l'erreur
      console.error("Erreur lors du suivi de l'utilisateur :", error.message);

      // Gestion des erreurs en fonction du type d'exception
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      }

      // Erreur générique
      throw new HttpException(
        "Une erreur interne s'est produite lors du suivi.",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // UNFOLLOW UN UTILISATEUR
  @Delete(':id/unfollow')
  unfollowUser(
    @Param('id') userId: string,
    @Body('followerId') followerId: number
  ) {
    return this.userService.unfollowUser(+userId, followerId);
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserData: UpdateUserDto
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');
  
    const updatedUser = await this.userService.updateUser(userId, updateUserData);
  
    return { message: 'Profil mis à jour avec succès', user: updatedUser };
  }

  @Put(':id/change-password')
  async changePassword(
    @Param('id') userId: number,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.userService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword
    );
  }

  @Get('/stats/:userId')
  async getUserStats(@Param('userId') userId: number) {
    return await this.userService.getUserStats(userId);
  }

  // SUPPRIME LE PROFIL DE L'UTILISATEUR
  @Delete(':id')
  @UseGuards(JwtAuthGuard) // Assure que l'utilisateur est authentifié
  async deleteUser(@Param('id') id: string) {
    const userId = parseInt(id, 10); // Convertit l'ID de chaîne en nombre
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');
    return this.userService.deleteUser(userId);
  }
}
