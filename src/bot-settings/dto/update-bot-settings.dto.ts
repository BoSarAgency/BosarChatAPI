import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsObject, Min, Max } from 'class-validator';

export class UpdateBotSettingsDto {
  @ApiProperty({ example: 'gpt-4', required: false })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({ example: 0.7, minimum: 0, maximum: 2, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({ example: 'You are a helpful customer service assistant.', required: false })
  @IsOptional()
  @IsString()
  systemInstructions?: string;

  @ApiProperty({ 
    example: [{ type: 'function', name: 'search_knowledge_base' }],
    description: 'Array of tool configurations',
    required: false
  })
  @IsOptional()
  @IsObject()
  tools?: any;
}
