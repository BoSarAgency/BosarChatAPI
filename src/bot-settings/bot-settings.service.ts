import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBotSettingsDto } from './dto/create-bot-settings.dto';
import { UpdateBotSettingsDto } from './dto/update-bot-settings.dto';

@Injectable()
export class BotSettingsService {
  constructor(private prisma: PrismaService) {}

  async create(createBotSettingsDto: CreateBotSettingsDto) {
    return this.prisma.botSettings.create({
      data: createBotSettingsDto,
    });
  }

  async findAll() {
    return this.prisma.botSettings.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const botSettings = await this.prisma.botSettings.findUnique({
      where: { id },
      include: {
        faqs: true,
        knowledgeBases: true,
      },
    });

    if (!botSettings) {
      throw new NotFoundException('Bot settings not found');
    }

    return botSettings;
  }

  async update(id: string, updateBotSettingsDto: UpdateBotSettingsDto) {
    // Check if bot settings exist
    await this.findOne(id);

    return this.prisma.botSettings.update({
      where: { id },
      data: updateBotSettingsDto,
    });
  }

  async remove(id: string) {
    // Check if bot settings exist
    await this.findOne(id);

    await this.prisma.botSettings.delete({
      where: { id },
    });

    return { message: 'Bot settings deleted successfully' };
  }

  async getLatest() {
    return this.prisma.botSettings.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        faqs: true,
        knowledgeBases: true,
      },
    });
  }
}
