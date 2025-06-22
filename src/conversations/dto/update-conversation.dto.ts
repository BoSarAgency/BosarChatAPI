import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ChatStatus } from '@prisma/client';

export class UpdateConversationDto {
  @ApiProperty({ example: 'user-id-here', required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: ChatStatus, example: ChatStatus.human, required: false })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;
}
