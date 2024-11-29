import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class S3Service {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      console.error('Invalid file:', file);
      throw new Error('Invalid file: Missing buffer');
    }
  
    console.log('Preparing to upload file:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${Date.now()}-${file.originalname}`, // Nom unique basé sur l'heure actuelle
      Body: file.buffer,
      ContentType: file.mimetype, // Type MIME du fichier
    };
  
    try {
      const uploadResult = await this.s3.upload(params).promise();
      console.log('Uploaded File URL:', uploadResult.Location);
      return uploadResult.Location;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }
}