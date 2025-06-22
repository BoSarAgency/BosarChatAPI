import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @ApiProperty({ example: 'bot-settings-id-here' })
  @IsString()
  @IsNotEmpty()
  botSettingsId: string;

  @ApiProperty({ example: 'pdf-document-id-here', required: false })
  @IsString()
  @IsOptional()
  pdfDocumentId?: string;

  @ApiProperty({
    example: [0.4, 0.5, 0.6],
    description: 'Vector embedding for knowledge base (1536 dimensions)',
  })
  @IsObject()
  embedding: number[];

  @ApiProperty({
    example: { type: 'faq', source: 'FAQ #1' },
    description: 'Metadata for the knowledge base entry',
  })
  @IsObject()
  metadata: any;

  @ApiProperty({
    example: 'Chapter 1: Introduction...',
    description: 'The actual text content for this knowledge base entry',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
