import {
  PutObjectCommand,
  S3Client,
  HeadBucketCommand,
  ListBucketsCommand,
  GetBucketLocationCommand,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.logger.log(`AWS Region: ${region}`);
    this.logger.log(
      `AWS Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'Not provided'}`,
    );
    this.logger.log(
      `AWS Secret Key: ${secretAccessKey ? 'Provided (length: ' + secretAccessKey.length + ')' : 'Not provided'}`,
    );

    // Use explicit credentials if provided, otherwise fall back to AWS SDK default credential chain
    const s3Config: any = {
      region,
      forcePathStyle: false, // Use virtual-hosted-style URLs
    };

    if (accessKeyId && secretAccessKey) {
      s3Config.credentials = {
        accessKeyId,
        secretAccessKey,
      };
      this.logger.log('Using explicit AWS credentials');
    } else {
      this.logger.log(
        'Using AWS SDK default credential chain (profile, IAM role, etc.)',
      );
    }

    this.s3Client = new S3Client(s3Config);

    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET') || 'caloriesense-uploads';

    this.logger.log(`S3 Bucket: ${this.bucketName}`);
  }

  /**
   * Uploads a file to S3
   * @param file The file to upload
   * @param key The key (path) to store the file at
   * @returns The URL of the uploaded file
   */
  async uploadFile(file: any, key?: string): Promise<string> {
    // Check if we should use local storage fallback
    const useLocalStorage =
      this.configService.get<string>('USE_LOCAL_STORAGE') === 'true';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');

    if (useLocalStorage || !accessKeyId) {
      this.logger.log('Using local storage fallback for file upload');
      return this.uploadFileLocally(file, key);
    }

    try {
      // Generate a unique key if not provided
      if (!key) {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/\s+/g, '-');
        key = `uploads/${timestamp}-${originalName}`;
      }

      this.logger.log(`Attempting to upload file to S3: ${key}`);
      this.logger.log(
        `File size: ${file.size || file.buffer?.length || 'unknown'} bytes`,
      );
      this.logger.log(`Content type: ${file.mimetype}`);
      this.logger.log(`Bucket: ${this.bucketName}`);
      this.logger.log(
        `Region: ${this.configService.get<string>('AWS_REGION') || 'us-east-1'}`,
      );

      // Additional debugging for credentials
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );
      this.logger.log(`Using credentials: ${accessKeyId ? 'YES' : 'NO'}`);
      this.logger.log(
        `Access Key starts with: ${accessKeyId ? accessKeyId.substring(0, 4) + '...' : 'N/A'}`,
      );

      // Upload the file to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      this.logger.log(`Sending PutObjectCommand to bucket: ${this.bucketName}`);
      await this.s3Client.send(command);

      // Construct the URL using the correct region
      const region =
        this.configService.get<string>('AWS_REGION') || 'us-east-1';
      const fileUrl = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      this.logger.log(`File uploaded successfully to ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file to S3: ${error.message}`);
      this.logger.error(`Error details:`, error);
      this.logger.warn('Falling back to local storage due to S3 error');

      // Fallback to local storage on S3 error
      return this.uploadFileLocally(file, key);
    }
  }

  /**
   * Upload file to local storage as fallback
   */
  private async uploadFileLocally(file: any, key?: string): Promise<string> {
    try {
      // Generate a unique key if not provided
      if (!key) {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/\s+/g, '-');
        key = `uploads/${timestamp}-${originalName}`;
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'pdfs');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        this.logger.log(`Created uploads directory: ${uploadsDir}`);
      }

      // Save file to local storage
      const fileName = path.basename(key);
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, file.buffer);

      // Generate a local URL
      const baseUrl =
        this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
      const fileUrl = `${baseUrl}/uploads/pdfs/${fileName}`;

      this.logger.log(`File saved locally to: ${filePath}`);
      this.logger.log(`File accessible at: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(`Error saving file locally: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test S3 connection and bucket access
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('Testing S3 connection...');
      const command = new HeadBucketCommand({
        Bucket: this.bucketName,
      });

      await this.s3Client.send(command);
      this.logger.log('S3 connection test successful');
      return true;
    } catch (error) {
      this.logger.error('S3 connection test failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive S3 credentials and configuration verification
   */
  async verifyCredentials(): Promise<{
    valid: boolean;
    details: any;
    errors: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const recommendations: string[] = [];
    const details: any = {};

    try {
      // 1. Check environment variables
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );
      const region =
        this.configService.get<string>('AWS_REGION') || 'us-east-1';
      const bucketName =
        this.configService.get<string>('AWS_S3_BUCKET') ||
        'caloriesense-uploads';

      details.configuration = {
        hasAccessKey: !!accessKeyId,
        accessKeyFormat: accessKeyId
          ? `${accessKeyId.substring(0, 4)}...${accessKeyId.substring(accessKeyId.length - 4)}`
          : 'Not provided',
        hasSecretKey: !!secretAccessKey,
        secretKeyLength: secretAccessKey ? secretAccessKey.length : 0,
        region,
        bucketName,
      };

      // Check credential format
      if (!accessKeyId) {
        errors.push('AWS_ACCESS_KEY_ID is not provided');
        recommendations.push(
          'Set AWS_ACCESS_KEY_ID in your environment variables',
        );
      } else if (!/^AKIA[0-9A-Z]{16}$/.test(accessKeyId)) {
        errors.push(
          'AWS_ACCESS_KEY_ID format appears invalid (should start with AKIA and be 20 characters)',
        );
        recommendations.push('Verify your AWS Access Key ID format');
      }

      if (!secretAccessKey) {
        errors.push('AWS_SECRET_ACCESS_KEY is not provided');
        recommendations.push(
          'Set AWS_SECRET_ACCESS_KEY in your environment variables',
        );
      } else if (secretAccessKey.length !== 40) {
        errors.push(
          'AWS_SECRET_ACCESS_KEY length appears invalid (should be 40 characters)',
        );
        recommendations.push('Verify your AWS Secret Access Key');
      }

      if (!accessKeyId || !secretAccessKey) {
        return {
          valid: false,
          details,
          errors,
          recommendations: [
            ...recommendations,
            'Will use local storage fallback',
          ],
        };
      }

      // 2. Test basic AWS credentials by listing buckets
      this.logger.log('Testing AWS credentials by listing buckets...');
      try {
        const listCommand = new ListBucketsCommand({});
        const listResult = await this.s3Client.send(listCommand);

        details.credentialsValid = true;
        details.bucketsAccessible = listResult.Buckets?.length || 0;
        details.bucketNames = listResult.Buckets?.map((b) => b.Name) || [];

        this.logger.log(
          `Successfully listed ${details.bucketsAccessible} buckets`,
        );
      } catch (credError: any) {
        errors.push(`Credential verification failed: ${credError.message}`);
        details.credentialsValid = false;

        if (credError.name === 'InvalidAccessKeyId') {
          recommendations.push(
            'Check your AWS_ACCESS_KEY_ID - it appears to be invalid',
          );
        } else if (credError.name === 'SignatureDoesNotMatch') {
          recommendations.push(
            'Check your AWS_SECRET_ACCESS_KEY - it appears to be incorrect',
          );
        } else if (credError.name === 'TokenRefreshRequired') {
          recommendations.push('Your AWS credentials may have expired');
        }

        return { valid: false, details, errors, recommendations };
      }

      // 3. Check if specified bucket exists and is accessible
      this.logger.log(`Testing access to bucket: ${bucketName}`);
      try {
        const headCommand = new HeadBucketCommand({ Bucket: bucketName });
        await this.s3Client.send(headCommand);

        details.bucketExists = true;
        details.bucketAccessible = true;
        this.logger.log(`Bucket ${bucketName} is accessible`);
      } catch (bucketError: any) {
        details.bucketExists = false;
        details.bucketAccessible = false;

        if (bucketError.name === 'NoSuchBucket') {
          errors.push(`Bucket '${bucketName}' does not exist`);
          recommendations.push(
            `Create bucket '${bucketName}' or update AWS_S3_BUCKET environment variable`,
          );
        } else if (bucketError.name === 'Forbidden') {
          errors.push(`Access denied to bucket '${bucketName}'`);
          recommendations.push(
            `Check IAM permissions for bucket '${bucketName}'`,
          );
        } else {
          errors.push(`Bucket access error: ${bucketError.message}`);
        }
      }

      // 4. Check bucket region
      if (details.bucketAccessible) {
        try {
          const locationCommand = new GetBucketLocationCommand({
            Bucket: bucketName,
          });
          const locationResult = await this.s3Client.send(locationCommand);
          const bucketRegion = locationResult.LocationConstraint || 'us-east-1';

          details.bucketRegion = bucketRegion;

          if (bucketRegion !== region) {
            errors.push(
              `Bucket region mismatch: bucket is in '${bucketRegion}' but configured region is '${region}'`,
            );
            recommendations.push(
              `Update AWS_REGION to '${bucketRegion}' or use a bucket in '${region}'`,
            );
          }
        } catch (regionError: any) {
          this.logger.warn(
            `Could not determine bucket region: ${regionError.message}`,
          );
        }
      }

      const isValid = errors.length === 0;

      return {
        valid: isValid,
        details,
        errors,
        recommendations: isValid
          ? ['S3 configuration is valid and ready to use']
          : recommendations,
      };
    } catch (error: any) {
      errors.push(`Verification failed: ${error.message}`);
      return {
        valid: false,
        details,
        errors,
        recommendations: [
          ...recommendations,
          'Check your AWS configuration and network connectivity',
        ],
      };
    }
  }
}
