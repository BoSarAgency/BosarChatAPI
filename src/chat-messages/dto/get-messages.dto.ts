import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesDto {
  @ApiProperty({ example: 'conversation-id-here' })
  @IsString()
  conversationId: string;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ example: 0, minimum: 0, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiProperty({ example: 'message-id-here', required: false, description: 'Get messages after this message ID' })
  @IsOptional()
  @IsString()
  after?: string;

  @ApiProperty({ example: 'message-id-here', required: false, description: 'Get messages before this message ID' })
  @IsOptional()
  @IsString()
  before?: string;
}
