import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mails')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * API pour envoyer un email.
   * @param body - Corps de la requête contenant les informations de l'email
   */
  @Post('send')
  async sendEmail(@Body() body: { to: string; subject: string; text: string; html: string }) {
    const { to, subject, text, html } = body;
    await this.mailService.sendEmail(to, subject, text, html);
    return { message: 'Email envoyé avec succès' };
  }
}