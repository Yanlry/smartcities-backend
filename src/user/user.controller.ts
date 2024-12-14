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

  @Get('ranking')
  async getUserRanking(@Query('userId') userId: number) {
    return this.userService.getUserRanking(userId);
  }

  // Récupère les 10 utilisateurs les plus récents avec leur photo de profil
  @Get('top10')
  async getTop10Smarter() {
    try {
      const users = await this.userService.listTop10Smarter(); // Appel au service
      return users; // Retourne directement les utilisateurs
    } catch (error) {
      throw new HttpException(
        'Erreur lors de la récupération des utilisateurs',
        500
      );
    }
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
      limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10 Mo
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
  followUser(
    @Param('id') userId: string,
    @Body('followerId') followerId: number
  ) {
    return this.userService.followUser(+userId, followerId);
  }

  // UNFOLLOW UN UTILISATEUR
  @Delete(':id/unfollow')
  unfollowUser(
    @Param('id') userId: string,
    @Body('followerId') followerId: number
  ) {
    return this.userService.unfollowUser(+userId, followerId);
  }

  // MET À JOUR LES INFORMATIONS DE PROFIL D'UN UTILISATEUR ET SON TRUST RATE
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserData: UpdateUserDto
  ) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');

    // Premièrement, met à jour les informations générales
    await this.userService.updateUser(userId, updateUserData);

    // Puis, met à jour le trustRate
    await this.userService.updateUserTrustRate(userId);

    return { message: 'Profil mis à jour avec succès' };
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

  // RÉCUPÈRE LES STATISTIQUES D'UN UTILISATEUR, INCLUANT LE TRUST RATE
  @Get('/stats/:userId')
  async getUserStats(@Param('userId') userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        votes: true, // Inclut les votes liés à cet utilisateur
        reports: true, // Inclut les signalements liés à cet utilisateur
      },
    });
  
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }
  
    return {
      numberOfReports: user.reports.length, // Nombre de signalements
      trustRate: user.trustRate, // Taux de confiance
      numberOfVotes: user.votes.length, // Nombre total de votes
      votes: user.votes.map((vote) => ({
        type: vote.type,
        reportId: vote.reportId,
        createdAt: vote.createdAt,
      })), // Détails des votes
    };
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
