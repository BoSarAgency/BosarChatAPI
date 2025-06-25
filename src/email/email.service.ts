import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import { SendEmailDto } from './dto';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private postmarkClient: postmark.ServerClient;
  private readonly defaultFromEmail: string;

  constructor(private configService: ConfigService) {
    // Initialize Postmark client
    const apiKey = this.configService.get<string>('POSTMARK_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'POSTMARK_API_KEY not found in environment variables. Email service may not work properly.',
      );
    }

    this.postmarkClient = new postmark.ServerClient(apiKey || 'dummy-key');

    this.defaultFromEmail = this.configService.get<string>(
      'FROM_EMAIL',
      'noreply@bosar.click',
    );
  }

  /**
   * Send a simple email using Postmark
   */
  async sendEmail(emailData: SendEmailDto): Promise<EmailResult> {
    try {
      const { to, from, subject, text, html, cc, bcc, replyTo } = emailData;

      // Validate that we have either text or html content
      if (!text && !html) {
        throw new Error('Email must contain either text or HTML content');
      }

      const message: postmark.Models.Message = {
        From: from || this.defaultFromEmail,
        To: to,
        Subject: subject,
        TextBody: text,
        HtmlBody: html,
        ...(cc && cc.length > 0 && { Cc: cc.join(', ') }),
        ...(bcc && bcc.length > 0 && { Bcc: bcc.join(', ') }),
        ...(replyTo && { ReplyTo: replyTo }),
      };

      const result = await this.postmarkClient.sendEmail(message);

      this.logger.log(
        `Email sent successfully to ${to}. MessageId: ${result.MessageID}`,
      );

      return {
        success: true,
        messageId: result.MessageID,
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${emailData.to}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send email with attachments using Postmark
   */
  async sendEmailWithAttachments(
    emailData: SendEmailDto,
  ): Promise<EmailResult> {
    try {
      if (!emailData.attachments || emailData.attachments.length === 0) {
        // If no attachments, use the simpler sendEmail method
        return this.sendEmail(emailData);
      }

      const { to, from, subject, text, html, cc, bcc, replyTo, attachments } =
        emailData;

      // Validate that we have either text or html content
      if (!text && !html) {
        throw new Error('Email must contain either text or HTML content');
      }

      // Convert attachments to Postmark format
      const postmarkAttachments: postmark.Models.Attachment[] = attachments.map(
        (attachment) => ({
          Name: attachment.filename,
          Content: attachment.content,
          ContentType: attachment.contentType,
          ContentID: null,
        }),
      );

      const message: postmark.Models.Message = {
        From: from || this.defaultFromEmail,
        To: to,
        Subject: subject,
        TextBody: text,
        HtmlBody: html,
        ...(cc && cc.length > 0 && { Cc: cc.join(', ') }),
        ...(bcc && bcc.length > 0 && { Bcc: bcc.join(', ') }),
        ...(replyTo && { ReplyTo: replyTo }),
        Attachments: postmarkAttachments,
      };

      const result = await this.postmarkClient.sendEmail(message);

      this.logger.log(
        `Email with attachments sent successfully to ${to}. MessageId: ${result.MessageID}`,
      );

      return {
        success: true,
        messageId: result.MessageID,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email with attachments to ${emailData.to}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a welcome email template
   */
  async sendWelcomeEmail(to: string, userName?: string): Promise<EmailResult> {
    const subject = 'Welcome to BoSar';
    const html = this.getWelcomeEmailTemplate(userName);
    const text = `Welcome to BoSar${userName ? `, ${userName}` : ''}!\n\nThank you for joining us. We're excited to have you on board.`;

    return this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
  ): Promise<EmailResult> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const subject = 'Password Reset Request';
    const html = this.getPasswordResetEmailTemplate(resetUrl);
    const text = `You requested a password reset. Click the following link to reset your password: ${resetUrl}`;

    return this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Get welcome email HTML template
   */
  private getWelcomeEmailTemplate(userName?: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to BoSar</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Welcome to BoSar${userName ? `, ${userName}` : ''}!</h1>
            <p>Thank you for joining us. We're excited to have you on board.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The BoSar Team</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get password reset email HTML template
   */
  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset Request</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Password Reset Request</h1>
            <p>You requested a password reset for your BoSar account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3498db;">${resetUrl}</p>
            <p><strong>Note:</strong> This link will expire in 24 hours for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>Best regards,<br>The BoSar Team</p>
          </div>
        </body>
      </html>
    `;
  }
}
