import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateMessageDto {
  @ApiProperty({ example: 'Hello, I need help with my order.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ enum: MessageRole, example: MessageRole.user })
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiProperty({ example: 'user-id-here', required: false })
  @IsOptional()
  @IsString()
  userId?: string;
}
