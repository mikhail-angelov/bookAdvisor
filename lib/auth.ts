import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const JWT_SECRET = process.env.AUTH_SECRET || "dev-secret-change-in-production";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export interface MagicLinkPayload {
  email: string;
  type: "magic-link";
  iat?: number;
  exp?: number;
}

export interface SessionPayload {
  userId: string;
  email: string;
  type: "session";
  iat?: number;
  exp?: number;
}

/**
 * Create a signed JWT for magic link authentication
 */
export function createMagicLinkToken(email: string): string {
  const payload: MagicLinkPayload = {
    email,
    type: "magic-link",
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

/**
 * Verify and decode a JWT magic link token
 */
export function verifyMagicLinkToken(token: string): MagicLinkPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MagicLinkPayload;
    if (decoded.type !== "magic-link") {
      throw new Error("Invalid token type");
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    }
    throw error;
  }
}

/**
 * Create a session JWT for authenticated users
 */
export function createSessionToken(userId: string, email: string): string {
  return jwt.sign({ userId, email, type: "session" }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

/**
 * Verify session JWT
 */
export function verifySessionToken(token: string): SessionPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
  if (decoded.type !== "session") {
    throw new Error("Invalid session token");
  }
  return decoded;
}

/**
 * Send magic link email
 */
export async function sendMagicLinkEmail(
  email: string,
  token: string,
): Promise<void> {
  const magicLink = `${APP_URL}/api/auth/verify?token=${token}`;

  // For development, log to console if no SMTP configured
  if (!process.env.POST_SERVICE_URL) {
    console.log("--- MAGIC LINK EMAIL ---");
    console.log(`To: ${email}`);
    console.log(`Link: ${magicLink}`);
    console.log("------------------------");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.POST_SERVICE_URL,
    port: parseInt(process.env.POST_PORT || "587"),
    secure: false, // false for port 587 (STARTTLS)
    auth: {
      user: process.env.POST_USER,
      pass: process.env.POST_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Book Advisor" <${process.env.SMTP_FROM || "no-reply@js2go.ru"}>`,
    to: email,
    subject: "Your Magic Link for Book Advisor",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Welcome to Book Advisor</h2>
        <p>Click the button below to sign in to your account. This link will expire in 15 minutes.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Sign In</a>
        </div>
        <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
      </div>
    `,
  });
}
