import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdatePdfDocumentDto {
  @ApiProperty({ example: 'updated-user-manual.pdf', required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/updated-user-manual.pdf', required: false })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ 
    example: [
      { page: 1, content: 'Updated Chapter 1...', embedding: [0.1, 0.2, 0.3] }
    ],
    description: 'Updated array of text chunks with embeddings',
    required: false
  })
  @IsOptional()
  @IsObject()
  chunks?: any;
}
