import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger,
  } from '@nestjs/common';
  
  @Catch()
  export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);
  
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : 500;
  
      const message =
        exception instanceof HttpException
          ? exception.getResponse()
          : exception;
  
      // Log the detailed error
      this.logger.error(`Status: ${status} - Error: ${JSON.stringify(message)}`);
  
      response.status(status).json({
        statusCode: status,
        message: message instanceof Object ? message : { message },
        timestamp: new Date().toISOString(),
      });
    }
  }