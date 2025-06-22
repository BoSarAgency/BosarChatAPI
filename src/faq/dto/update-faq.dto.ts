import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFaqDto {
  @ApiProperty({ example: 'What are your business hours?', required: false })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiProperty({ example: 'Our business hours are Monday to Friday, 9 AM to 5 PM.', required: false })
  @IsOptional()
  @IsString()
  answer?: string;
}
