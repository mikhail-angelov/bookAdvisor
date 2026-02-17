import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '1h'; // 1 hour

export interface MagicLinkPayload {
  email: string;
  type: 'magic-link';
  iat?: number;
  exp?: number;
}

/**
 * Create a signed JWT for magic link authentication
 */
export function createMagicLinkToken(email: string): string {
  const payload: MagicLinkPayload = {
    email,
    type: 'magic-link',
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode a JWT magic link token
 * Returns the payload if valid, throws error if invalid/expired
 */
export function verifyMagicLinkToken(token: string): MagicLinkPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MagicLinkPayload;
    
    // Ensure this is a magic-link token
    if (decoded.type !== 'magic-link') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Create a session JWT for authenticated users
 */
export function createSessionToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email, type: 'session' },
    JWT_SECRET,
    { expiresIn: '7d' } // 7 days session
  );
}

/**
 * Verify session JWT
 */
export function verifySessionToken(token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  
  if (decoded.type !== 'session') {
    throw new Error('Invalid session token');
  }
  
  return { userId: decoded.userId, email: decoded.email };
}
