import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class HumanTakeoverDto {
  @ApiProperty({ example: 'Customer requested human agent', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
