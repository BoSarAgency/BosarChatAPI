# Email Service Module

This module provides email functionality using Postmark for the ACQG API.

## Features

- ✅ Send plain text and HTML emails
- ✅ Send emails with attachments
- ✅ Pre-built email templates (welcome, password reset)
- ✅ Support for CC, BCC, and Reply-To
- ✅ Comprehensive error handling and logging
- ✅ Service-only implementation (no HTTP endpoints)

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```env
# Postmark Email Service
POSTMARK_API_KEY=your-postmark-api-key
FROM_EMAIL=noreply@bosar.click

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

### Postmark Setup

Before using this service, you need to:

1. **Create a Postmark account** at https://postmarkapp.com
2. **Verify your domain** (`bosar.click`) in Postmark
3. **Configure DNS records** for domain verification and DKIM
4. **Get your Server API Token** from Postmark dashboard

## Usage

### Service Methods

#### Basic Email Sending

```typescript
import { EmailService } from './email/email.service';

// Inject the service
constructor(private emailService: EmailService) {}

// Send a basic email
const result = await this.emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Hello World',
  text: 'This is a plain text email',
  html: '<h1>This is an HTML email</h1>'
});

if (result.success) {
  console.log('Email sent successfully:', result.messageId);
} else {
  console.error('Failed to send email:', result.error);
}
```

#### Email with Attachments

```typescript
const result = await this.emailService.sendEmailWithAttachments({
  to: 'user@example.com',
  subject: 'Email with Attachment',
  html: '<p>Please find the attachment below.</p>',
  attachments: [
    {
      filename: 'document.pdf',
      content: 'base64-encoded-content-here',
      contentType: 'application/pdf',
    },
  ],
});
```

#### Pre-built Templates

```typescript
// Send welcome email
await this.emailService.sendWelcomeEmail('user@example.com', 'John Doe');

// Send password reset email
await this.emailService.sendPasswordResetEmail(
  'user@example.com',
  'reset-token-123',
);
```

### Service Usage

The EmailService is designed to be used internally by other services and modules. It provides programmatic access to email functionality without HTTP endpoints.

#### Service Methods

All methods return a `Promise<EmailResult>` with the following structure:

```typescript
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## Email Templates

### Welcome Email Template

- **Subject**: "Welcome to ACQG"
- **Content**: Branded HTML template with user name
- **Styling**: Responsive design with ACQG branding

### Password Reset Email Template

- **Subject**: "Password Reset Request"
- **Content**: Secure reset link with expiration notice
- **Features**: Button and fallback link, security warnings

### Custom Templates

You can extend the service to add more templates:

```typescript
// In email.service.ts
async sendCustomEmail(to: string, templateData: any): Promise<EmailResult> {
  const subject = 'Custom Email Subject';
  const html = this.getCustomEmailTemplate(templateData);

  return this.sendEmail({
    to,
    subject,
    html,
  });
}

private getCustomEmailTemplate(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Custom Template</h1>
        <p>Hello ${data.name}!</p>
      </body>
    </html>
  `;
}
```

## Error Handling

The service includes comprehensive error handling:

- **Postmark API errors**: Network issues, authentication failures
- **Validation errors**: Invalid email addresses, missing content
- **Rate limiting**: Postmark quota exceeded
- **Domain issues**: Unverified sender domains

All errors are logged with appropriate context for debugging.

## Testing

### Unit Tests

```bash
npm run test -- email
```

### Integration Tests

```bash
# Make sure Postmark API key is configured
npm run test:e2e -- email
```

### Manual Testing

Create test scripts that directly use the EmailService methods to test functionality.

## Monitoring

### Logging

The service logs all email operations:

- Successful sends with message IDs
- Failed attempts with error details
- Performance metrics

### Postmark Dashboard

Monitor email metrics in Postmark:

- Send rate and volume
- Bounce and complaint rates
- Delivery delays

### Health Checks

The service validates Postmark API key on startup and logs warnings for configuration issues.

## Security Considerations

1. **Input Validation**: Email addresses and content are validated
2. **Rate Limiting**: Consider implementing application-level rate limiting
3. **Credential Management**: Secure Postmark API key storage
4. **Content Filtering**: Validate email content to prevent abuse
5. **Service Access**: Control access to EmailService through proper dependency injection

## Migration to Postmark

If migrating to Postmark from another service:

1. Keep previous email service configuration as fallback
2. Test Postmark thoroughly in development
3. Update email templates to match Postmark format
4. Monitor delivery rates during transition
5. Update DNS records for better deliverability

## Troubleshooting

### Common Issues

1. **"Email address not verified"**: Domain not verified in Postmark
2. **"Daily sending quota exceeded"**: Request limit increase
3. **"Invalid API key"**: Check Postmark API key configuration
4. **High bounce rate**: Clean email list, check DNS records

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development
```

This will provide more verbose error messages and Postmark API debug information.

## Performance

- **Async operations**: All email sending is asynchronous
- **Connection pooling**: Postmark SDK handles connection management
- **Retry logic**: Built-in retry for transient failures
- **Batch sending**: Consider implementing for bulk emails

## Contributing

When adding new features:

1. Add appropriate TypeScript types
2. Include Swagger documentation
3. Add unit tests
4. Update this README
5. Test with real Postmark account
