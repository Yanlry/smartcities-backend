import { Controller,Patch, Get, Put, Post, Delete, Param, Body, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Pour sécuriser l'accès avec un token JWT

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  // RECUPERER LE NOMBRE DE FOLLOWER D'UN UTILISATEUR
  @Get(':id')
  async getUserWithFollowers(@Param('id') userId: string) {
    return this.userService.getUserWithFollowers(Number(userId));
  }

  // SUIVRE UN UTILISATEUR
  @Post(':id/follow')
  followUser(@Param('id') userId: string, @Body('followerId') followerId: number) {
    return this.userService.followUser(+userId, followerId);
  }

  // UNFOLLOW UN UTILISATEUR
  @Delete(':id/unfollow')
  unfollowUser(@Param('id') userId: string, @Body('followerId') followerId: number) {
    return this.userService.unfollowUser(+userId, followerId);
  }

  // RÉCUPÈRE LE PROFIL D'UN UTILISATEUR PAR SON ID
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const userId = parseInt(id, 10); // Convertit l'ID de chaîne en nombre
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');
    return this.userService.getUserById(userId);
  }

  // MET À JOUR LES INFORMATIONS DE PROFIL D'UN UTILISATEUR ET SON TRUST RATE
  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updateUserData: UpdateUserDto) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');
    
    // Premièrement, met à jour les informations générales
    await this.userService.updateUser(userId, updateUserData);

    // Puis, met à jour le trustRate
    await this.userService.updateUserTrustRate(userId);

    return { message: 'Profil mis à jour avec succès' };
  }

  // LISTE LES UTILISATEURS AVEC DES FILTRES OPTIONNELS
  @Get()
  async listUsers(@Query() filters: any) {
    return this.userService.listUsers(filters);
  }

  // RÉCUPÈRE LES STATISTIQUES D'UN UTILISATEUR, INCLUANT LE TRUST RATE
  @Get(':id/stats')
  async getUserStats(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new BadRequestException('Invalid user ID');
    return this.userService.getUserStats(userId);
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
