import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Client } from 'postmark';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private postmarkClient: Client;
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.postmarkClient = new Client(
      this.configService.get('POSTMARK_API_KEY') || '',
    );
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, ...userData } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        ...userData,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
      },
    });

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 216000000 * 60); // 60 days from now

    // Save reset request
    await this.prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send email
    try {
      const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;
      await this.postmarkClient.sendEmailWithTemplate({
        From: this.configService.get('FROM_EMAIL') || '',
        To: email,
        TemplateId: 40338956,
        TemplateModel: {
          product_name: 'BoSar',
          action_url: resetUrl,
        },
      });
    } catch (error) {
      console.error(error);
    }

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { email, ...updateData } = updateUserDto;

    // Check if user exists
    await this.findOne(id);

    const dataToUpdate: any = { ...updateData };

    // Check if email is being updated and if it already exists
    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('User with this email already exists');
      }

      dataToUpdate.email = email.toLowerCase();
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
      },
    });

    return user;
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto) {
    const { password, ...updateData } = updateProfileDto;

    // Check if user exists
    await this.findOne(id);

    const dataToUpdate: any = { ...updateData };

    // Hash password if provided
    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
      },
    });

    return user;
  }

  async remove(id: string) {
    // Check if user exists
    await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
