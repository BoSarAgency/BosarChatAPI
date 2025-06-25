import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailAttachment {
  @ApiProperty({ description: 'Filename of the attachment' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'Content of the attachment (base64 encoded)' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Content type of the attachment' })
  @IsString()
  contentType: string;
}

export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({
    description: 'Sender email address (defaults to noreply@bosar.click)',
    example: 'noreply@bosar.click',
  })
  @IsOptional()
  @IsEmail()
  from?: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Welcome to BoSar',
  })
  @IsString()
  subject: string;

  @ApiPropertyOptional({
    description: 'Plain text content of the email',
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: 'HTML content of the email',
  })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({
    description: 'CC recipients',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional({
    description: 'BCC recipients',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @ApiPropertyOptional({
    description: 'Reply-to email address',
  })
  @IsOptional()
  @IsEmail()
  replyTo?: string;

  @ApiPropertyOptional({
    description: 'Email attachments',
    type: [EmailAttachment],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachment)
  attachments?: EmailAttachment[];
}
