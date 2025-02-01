import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async listGroups() {
    return this.groupsService.listGroups();
  }

  @Post()
  async createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @Body('ownerId', ParseIntPipe) ownerId: number
  ) {
    if (!ownerId) {
      throw new NotFoundException('Propriétaire du groupe non spécifié');
    }
    return this.groupsService.createGroup(createGroupDto, ownerId);
  }

  @Get(':id')
  async getGroupById(@Param('id', ParseIntPipe) groupId: number) {
    return this.groupsService.getGroupById(groupId);
  }

  @Post(':id/join')
  async joinGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Body() body: { userId: number }
  ) {
    const { userId } = body;
    if (!userId) {
      throw new NotFoundException("L'ID de l'utilisateur est requis pour rejoindre le groupe");
    }
    return this.groupsService.joinGroup(groupId, userId);
  }

  @Post(':id/leave')
  async leaveGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Body('userId', ParseIntPipe) userId: number
  ) {
    if (!userId) {
      throw new NotFoundException("L'ID de l'utilisateur est requis pour quitter le groupe");
    }
    return this.groupsService.leaveGroup(groupId, userId);
  }

  @Get(':id/members')
  async getGroupMembers(@Param('id', ParseIntPipe) groupId: number) {
    return this.groupsService.getGroupMembers(groupId);
  }

  @Delete(':id')
  async deleteGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Body('ownerId', ParseIntPipe) ownerId: number
  ) {
    if (!ownerId) {
      throw new NotFoundException("L'ID du propriétaire est requis pour supprimer le groupe");
    }
    return this.groupsService.deleteGroup(groupId, ownerId);
  }
}