import { Controller, Get, Post, Body, Param, Query, Put } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    // RÉCUPÉRER LES CONVERSATIONS DE L'UTILISATEUR
    @Get('conversations')
    getConversations(@Query('userId') userId: number) {
        return this.messagesService.getConversations(Number(userId));
    }

    // RÉCUPÉRER LES MESSAGES D'UNE CONVERSATION SPÉCIFIQUE PAR SON ID
    @Get(':conversationId')
    getMessages(@Param('conversationId') conversationId: number) {
        return this.messagesService.getMessages(Number(conversationId));
    }

    // ENVOYER UN MESSAGE DANS UNE CONVERSATION (CRÉATION SI NÉCESSAIRE)
    @Post('send')
    sendMessage(@Body() sendMessageDto: SendMessageDto) {
        return this.messagesService.sendMessage(sendMessageDto);
    }

    // MARQUER LES MESSAGES COMME LUS DANS UNE CONVERSATION
    @Put('mark-read')
    markMessagesAsRead(@Body() markReadDto: MarkReadDto) {
        return this.messagesService.markMessagesAsRead(markReadDto);
    }

    // RÉCUPÉRER LES MESSAGES D'UNE MAIRIE POUR UN UTILISATEUR (SEULS LES ABONNÉS)
    @Get('municipality/:municipalityId')
    getMunicipalityMessages(
        @Query('userId') userId: string, // ID de l'utilisateur
        @Param('municipalityId') municipalityId: string // ID de la mairie
    ) {
        return this.messagesService.getMunicipalityMessages(Number(userId), Number(municipalityId));
    }

    // ENVOYER UN MESSAGE À UNE MAIRIE SPÉCIFIQUE
    @Post('municipality/:municipalityId/send')
    sendMunicipalityMessage(
        @Body() sendMessageDto: SendMessageDto,
        @Param('municipalityId') municipalityId: string
    ) {
        return this.messagesService.sendMunicipalityMessage(sendMessageDto, Number(municipalityId));
    }
}
