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
    throw new Error('Invalid file: Missing buffer.');
  }

  const params: AWS.S3.PutObjectRequest = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${Date.now()}-${file.originalname}`, 
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const uploadResult = await this.s3.upload(params).promise();
    console.log('File uploaded successfully:', uploadResult);
    return uploadResult.Location; 
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

async updateFile(oldFileUrl: string, newFile: Express.Multer.File): Promise<string> {
  if (!newFile || !newFile.buffer) {
    throw new Error('Invalid file: Missing buffer.');
  }

  const bucketName = process.env.AWS_BUCKET_NAME;
  const oldFileKey = oldFileUrl.split(`${bucketName}/`)[1];

  if (!oldFileKey) {
    throw new Error('Could not extract file key from URL.');
  }

  const params: AWS.S3.PutObjectRequest = {
    Bucket: bucketName,
    Key: oldFileKey,
    Body: newFile.buffer,
    ContentType: newFile.mimetype,
  };

  try {
    const uploadResult = await this.s3.upload(params).promise();
    console.log('File updated successfully:', uploadResult);
    return uploadResult.Location;
  } catch (error) {
    console.error('Error updating file in S3:', error);
    throw new Error(`Failed to update file in S3: ${error.message}`);
  }
}


  /**
   * Delete a file from S3.
   * @param fileUrl 
   * @returns 
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      throw new Error('Invalid file URL.');
    }
  
    const bucketName = process.env.AWS_BUCKET_NAME;
    const fileKey = fileUrl.includes(bucketName)
      ? fileUrl.split(`${bucketName}/`)[1]
      : null;
  
    if (!fileKey) {
      throw new Error('Could not extract file key from URL.');
    }
  
    const params: AWS.S3.DeleteObjectRequest = {
      Bucket: bucketName,
      Key: fileKey,
    };
  
    try {
      await this.s3.deleteObject(params).promise();
      console.log('File deleted successfully:', fileKey);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }
  
}
