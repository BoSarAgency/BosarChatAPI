import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePdfDocumentDto {
  @ApiProperty({ example: 'user-manual.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/user-manual.pdf' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    example: ['Chapter 1: Introduction...', 'Chapter 2: Getting Started...'],
    description: 'Array of text chunks extracted from PDF with embeddings',
  })
  @IsOptional()
  @IsObject()
  chunks?: any;

  @ApiProperty({ example: 'bot-settings-id-here' })
  @IsString()
  @IsNotEmpty()
  botSettingsId: string;
}
