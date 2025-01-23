import { Controller, Get, Post, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) { }

  @Get()
  async listGroups() {
    return this.groupsService.listGroups();
  }

  @Post()
  async createGroup(@Body() createGroupDto: CreateGroupDto, @Body('ownerId') ownerId: number) {
    if (!ownerId) {
      throw new NotFoundException('Propriétaire du groupe non spécifié');
    }
    return this.groupsService.createGroup(createGroupDto, ownerId);
  }

  @Get(':id')
  async getGroupById(@Param('id') id: string) {
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.getGroupById(groupId);
  }

  @Post(':id/join')
  async joinGroup(@Param('id') groupId: string, @Body() body: { userId: number }) {
    if (!body.userId) {
      throw new NotFoundException("L'ID de l'utilisateur est requis pour rejoindre le groupe");
    }
    const id = parseInt(groupId, 10);
    return this.groupsService.joinGroup(id, body.userId);
  }

  @Post(':id/leave')
  async leaveGroup(@Param('id') id: string, @Body('userId') userId: number) {
    if (!userId) {
      throw new NotFoundException("L'ID de l'utilisateur est requis pour quitter le groupe");
    }
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.leaveGroup(groupId, userId);
  }

  @Get(':id/members')
  async getGroupMembers(@Param('id') id: string) {
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.getGroupMembers(groupId);
  }

  @Delete(':id')
  async deleteGroup(@Param('id') id: string, @Body('ownerId') ownerId: number) {
    if (!ownerId) {
      throw new NotFoundException("L'ID du propriétaire est requis pour supprimer le groupe");
    }
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.deleteGroup(groupId, ownerId);
  }
}
