import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Client } from 'postmark';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private postmarkClient: Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.postmarkClient = new Client(
      this.configService.get('POSTMARK_API_KEY') || '',
    );
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (
      user &&
      user.status === 'active' &&
      (await bcrypt.compare(password, user.password))
    ) {
      // Update last accessed time
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastAccessedAt: new Date() },
      });

      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists or not
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset request
    await this.prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send email
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;

    try {
      await this.postmarkClient.sendEmailWithTemplate({
        From: this.configService.get('FROM_EMAIL') || '',
        To: email.toLowerCase(),
        TemplateId: 40338421,
        TemplateModel: {
          product_name: 'BoSar',
          action_url: resetUrl,
        },
      });
    } catch (error) {
      console.error(error);
    }

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const resetRequest = await this.prisma.passwordResetRequest.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !resetRequest ||
      resetRequest.used ||
      resetRequest.expiresAt < new Date() ||
      !resetRequest.userId ||
      !resetRequest.user
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and last accessed time
    const updatedUser = await this.prisma.user.update({
      where: { id: resetRequest.userId },
      data: {
        password: hashedPassword,
        lastAccessedAt: new Date(),
      },
    });

    // Mark reset request as used
    await this.prisma.passwordResetRequest.update({
      where: { id: resetRequest.id },
      data: { used: true },
    });

    // Generate access token and return user info like in login
    const payload = {
      email: updatedUser.email,
      sub: updatedUser.id,
      role: updatedUser.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
      message: 'Password reset successfully',
    };
  }
}
