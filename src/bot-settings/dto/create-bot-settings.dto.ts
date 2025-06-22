import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsObject, Min, Max } from 'class-validator';

export class CreateBotSettingsDto {
  @ApiProperty({ example: 'gpt-4' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 0.7, minimum: 0, maximum: 2 })
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature: number;

  @ApiProperty({ example: 'You are a helpful customer service assistant.' })
  @IsString()
  @IsNotEmpty()
  systemInstructions: string;

  @ApiProperty({ 
    example: [{ type: 'function', name: 'search_knowledge_base' }],
    description: 'Array of tool configurations'
  })
  @IsObject()
  tools: any;
}
