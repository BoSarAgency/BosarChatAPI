import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class UpdateKnowledgeBaseDto {
  @ApiProperty({
    example: [0.1, 0.2, 0.3],
    description: 'Updated vector embeddings and metadata',
    required: false,
  })
  @IsOptional()
  @IsObject()
  embeddings?: any;
}
