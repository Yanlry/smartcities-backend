import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    // Récupération du message
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message;

    // Log l'erreur pour le développement
    this.logger.error(
      `Status: ${status} - Error: ${JSON.stringify(exceptionResponse)}`
    );

    // Envoi d'une réponse simplifiée au frontend
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message, // Si message est un tableau, on prend le premier élément
      timestamp: new Date().toISOString(),
    });
  }
}