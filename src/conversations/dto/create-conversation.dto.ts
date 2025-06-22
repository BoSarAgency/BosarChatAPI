import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ example: 'customer-123' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'user-id-here', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: 'bot-settings-id-here' })
  @IsString()
  @IsNotEmpty()
  botSettingsId: string;
}
