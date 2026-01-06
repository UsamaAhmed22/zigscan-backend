import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail, { MailDataRequired } from '@sendgrid/mail';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly assetsPath: string;
  private readonly apiUrl: string;
  private readonly frontendUrl: string;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    // In production (dist folder), __dirname is /app/dist/users, assets are at /app/dist/assets
    // In development (src folder), __dirname is /path/to/src/users, assets are at /path/to/src/assets
    this.assetsPath = path.join(__dirname, '..', 'assets');
    this.logger.log(`Assets path: ${this.assetsPath}`);
    // Load required URLs from environment (throws if missing)
    this.apiUrl = this.getRequiredConfig('API_URL');
    this.frontendUrl = this.getRequiredConfig('FRONTEND_URL');
    this.fromEmail = this.getRequiredConfig('SMTP_FROM');

    this.initializeSendGrid();
  }

  /**
   * Initialize SendGrid client
   */
  private initializeSendGrid() {
    try {
      const apiKey = this.getSendGridApiKey();
      sgMail.setApiKey(apiKey);
      this.logger.log('✓ Email service initialized with SendGrid');
    } catch (error) {
      this.logger.error(
        'Failed to initialize SendGrid client:',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Get required config value or throw a clear error
   */
  private getRequiredConfig(key: string): string {
    const val = this.configService.get<string>(key);
    if (!val) {
      this.logger.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return val;
  }

  private getSendGridApiKey(): string {
    const apiKey =
      this.configService.get<string>('SENDGRID_API_KEY') ||
      this.configService.get<string>('SMTP_PASS');
    if (!apiKey) {
      this.logger.error('Missing SendGrid API key (SENDGRID_API_KEY or SMTP_PASS)');
      throw new Error('Missing SendGrid API key');
    }
    return apiKey;
  }

  /**
   * Send password reset email with 6-digit code
   */
  async sendPasswordResetEmail(email: string, code: string, username: string): Promise<void> {
    const resetPageUrl = `${this.frontendUrl}/reset-password`;

    const mailOptions: MailDataRequired = {
      from: this.fromEmail,
      to: email,
      subject: 'Password reset code - ZIGScan',
      html: `
        <!DOCTYPE html>
        <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            <title>OTP Email</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
          </head>
          <body style="margin:0; padding:0; background:#f3f4f6; -webkit-font-smoothing:antialiased; -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;">
            <div style="display:none; opacity:0; visibility:hidden; overflow:hidden; height:0; width:0; max-height:0; max-width:0; mso-hide:all;">Your One Time Password (OTP) for verification.</div>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; background:#ffffff; border-radius:16px; border:1px solid #e5e7eb; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05); overflow:hidden;">                
                   
                    <tr>
                      <td style="padding:24px 24px 8px 24px;"><p style="margin:0; font-size:24px; line-height:32px; font-weight:600; color:#111827;">Hi ${username},</p></td>
                    </tr>
                    <tr>
                      <td style="padding:8px 24px 0 24px;"><p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">Here is your One Time Password (OTP).<br/>Please enter this code to verify your email address for ZIGScan</p></td>
                    </tr>

                    <tr>
                      <td align="center" style="padding:20px 24px 8px 24px;">
                        <div id="otp-code" style="display:inline-block; padding:8px 12px; border:1px dashed #e5e7eb; border-radius:8px; background:#f9fafb; font-weight:600; font-size:60px; color:#253353; letter-spacing:20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${code}</div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:8px 24px 0 24px;">
                        <p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">OTP will expire in <span style="font-weight:700; color:#111827;">3 minutes</span>. You can request a new code after <span style="font-weight:700; color:#111827;">1 minute.</span></p>
                        <p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">Didn't request this? Ignore this email.</p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:24px 24px 0 24px;"><p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">Best Regards,<br/><a href="https://ZIGScan.org" target="_blank" rel="noopener noreferrer" style="color:#4f46e5; font-weight:600; text-decoration:none;">ZIGScan Team</a></p></td>
                    </tr>                   

                    <tr>
                      <td align="center" style="padding:16px 24px 8px 24px;"><p style="margin:0; font-size:12px; line-height:18px; color:#6b7280;">© 2025 ZIGScan. All rights reserved.</p></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `
Password Reset Code - ZIGScan

Hi ${username},

Your password reset code: ${code}

Expires in: 3 minutes

Steps:
1. Go to ${resetPageUrl}
2. Enter code: ${code}
3. Set new password

Didn't request this? Ignore this email.

ZIGScan © 2025
      `,
    };

    await this.sendMail(
      mailOptions,
      `✓ Password reset email sent to ${email}`,
      'Failed to send password reset email',
    );
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string, username: string): Promise<void> {
    // Verification link that will verify email and redirect to verification page
    const verifyUrl = `${this.apiUrl}/api/v2/auth/verify-email-redirect?token=${token}&redirect=${encodeURIComponent(this.frontendUrl + '/user/verify-email')}`;

    const mailOptions: MailDataRequired = {
      from: this.fromEmail,
      to: email,
      subject: 'Verify your email - ZIGScan',
      html: `
        <!DOCTYPE html>
        <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            <title>Verify your email</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
          </head>
          <body style="margin:0; padding:0; background:#f3f4f6; -webkit-font-smoothing:antialiased; -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;">
            <div style="display:none; opacity:0; visibility:hidden; overflow:hidden; height:0; width:0; max-height:0; max-width:0; mso-hide:all;">Verify your email to access your ZIGScan dashboard.</div>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; background:#ffffff; border-radius:16px; border:1px solid #e5e7eb; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05); overflow:hidden;">                   

                    <tr>
                      <td style="padding:24px 24px 8px 24px;">
                        <p style="margin:0; font-size:24px; line-height:32px; font-weight:700; color:#111827;">Welcome to ZIGScan!</p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:8px 24px 0 24px;"><p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">Hi ${username},</p></td>
                    </tr>
                    <tr>
                      <td style="padding:4px 24px 0 24px;"><p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">Thanks for signing up! Click below to verify your email and access your dashboard.</p></td>
                    </tr>

                    <tr>
                      <td align="center" style="padding:20px 24px 0 24px;">
                        <a href="${verifyUrl}" style="display:inline-block; background:#4f46e5; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; line-height:20px; padding:12px 20px; border-radius:10px;">Verify Email</a>
                      </td>
                    </tr>
                   
                    <tr>
                      <td style="padding:16px 24px 0 24px;"><p style="margin:0; font-size:14px; line-height:22px; color:#4b5563;">Didn't sign up? Ignore this email.</p></td>
                    </tr>

                    <tr>
                      <td style="padding:24px 24px 0 24px;"><p style="margin:0; font-size:15px; line-height:24px; color:#4b5563;">Best Regards,<br/><a href="https://ZIGScan.org" target="_blank" rel="noopener noreferrer" style="color:#4f46e5; font-weight:600; text-decoration:none;">ZIGScan Team</a></p></td>
                    </tr>                    

                    <tr>
                      <td align="center" style="padding:16px 24px 8px 24px;"><p style="margin:0; font-size:12px; line-height:18px; color:#6b7280;">© 2025 ZIGScan. All rights reserved.</p></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `
Welcome to ZIGScan!

Hi ${username},

Thanks for signing up! Click to verify: ${verifyUrl}

This will activate your account and redirect you to your dashboard.

Didn't sign up? Ignore this email.

ZIGScan © 2025
      `,
    };

    await this.sendMail(
      mailOptions,
      `✓ Verification email sent to ${email}`,
      'Failed to send verification email',
    );
  }

  private async sendMail(
    data: MailDataRequired,
    successMessage: string,
    failureMessage: string,
  ): Promise<void> {
    try {
      await sgMail.send(data);
      this.logger.log(successMessage);
    } catch (error) {
      this.logger.error(
        `${failureMessage} to ${data.to}:`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new Error(failureMessage);
    }
  }
}
