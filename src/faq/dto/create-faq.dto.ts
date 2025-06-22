import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({ example: 'bot-settings-id-here' })
  @IsString()
  @IsNotEmpty()
  botSettingsId: string;

  @ApiProperty({ example: 'What are your business hours?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'Our business hours are Monday to Friday, 9 AM to 5 PM.' })
  @IsString()
  @IsNotEmpty()
  answer: string;
}
