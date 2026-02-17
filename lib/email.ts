import nodemailer from 'nodemailer';

// SMTP configuration from environment
const config = {
  host: process.env.POST_SERVICE_URL,
  port: parseInt(process.env.POST_PORT || '587'),
  secure: false, // false for port 587 (STARTTLS)
  auth: {
    user: process.env.POST_USER,
    pass: process.env.POST_PASS,
  },
};

// Create transporter
const transporter = nodemailer.createTransport(config);

/**
 * Send magic link email
 */
export async function sendMagicLinkEmail(
  email: string,
  magicLink: string
): Promise<boolean> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verifyUrl = `${appUrl}/api/auth/verify?token=${magicLink}`;

    const mailOptions = {
      from: process.env.POST_FROM || 'no-reply@js2go.ru',
      to: email,
      subject: 'Your Magic Login Link',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Login to Rutracker Crawler</h2>
          <p>Click the button below to sign in:</p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Sign In
          </a>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link in your browser:<br>
            ${verifyUrl}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('[EMAIL] Magic link sent to:', email);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send magic link:', error);
    return false;
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('[EMAIL] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[EMAIL] SMTP connection failed:', error);
    return false;
  }
}
