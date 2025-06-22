import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { MessageRole } from '@prisma/client';

export class WebSocketMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(MessageRole)
  role: MessageRole;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class WebSocketJoinRoomDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}

export class WebSocketAuthDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

// Widget-specific DTOs for anonymous customers
export class WidgetConnectDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsOptional()
  @IsString()
  customerIp?: string;
}

export class WidgetMessageDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
