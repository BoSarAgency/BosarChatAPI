import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class SearchKnowledgeBaseDto {
  @ApiProperty({ example: 'What are your business hours?' })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 50, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @ApiProperty({ example: 0.7, minimum: 0, maximum: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.7;
}
