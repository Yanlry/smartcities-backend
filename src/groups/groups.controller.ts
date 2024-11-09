import { Controller, Get, Post, Delete, Param, Body, NotFoundException } from '@nestjs/common';
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
  async createGroup(@Body() createGroupDto: CreateGroupDto, @Body('ownerId') ownerId: number) {
    return this.groupsService.createGroup(createGroupDto, ownerId);
  }

  @Get(':id')
  async getGroupById(@Param('id') id: string) {
    const groupId = parseInt(id, 10); // Conversion de string en number
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.getGroupById(groupId);
  }

  @Post(':id/join')
  async joinGroup(@Param('id') groupId: string, @Body() body: { userId: number }) {
    const id = parseInt(groupId, 10);
    return this.groupsService.joinGroup(id, body.userId);
  }

  @Post(':id/leave')
  async leaveGroup(@Param('id') id: string, @Body('userId') userId: number) {
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.leaveGroup(groupId, userId);
  }

  @Get(':id/members')
  async getGroupMembers(@Param('id') id: string) {
    const groupId = parseInt(id, 10); // Convertit l'ID de chaîne en nombre
    if (isNaN(groupId)) {
      throw new NotFoundException('ID de groupe invalide');
    }
    return this.groupsService.getGroupMembers(groupId);
  }

  @Delete(':id')
  async deleteGroup(@Param('id') id: number, @Body('ownerId') ownerId: number) {
    return this.groupsService.deleteGroup(id, ownerId);
  }
}
