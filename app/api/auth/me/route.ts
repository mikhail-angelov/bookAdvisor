import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  verifySessionToken,
  createSessionToken,
  shouldRefreshSession,
  getSessionCookieOptions,
  getUserIdCookieOptions,
} from '@/lib/auth';

// Force dynamic rendering to prevent any caching
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const payload = verifySessionToken(token);
    const db = await getAppDbAsync();
    
    const existingUser = await db.select().from(user).where(eq(user.id, payload.userId)).get();
    
    if (!existingUser) {
      return NextResponse.json({ authenticated: false });
    }

    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
      },
    });

    if (shouldRefreshSession(payload)) {
      response.cookies.set(
        'auth_token',
        createSessionToken(existingUser.id, existingUser.email),
        getSessionCookieOptions(),
      );
      response.cookies.set('user_id', existingUser.id, getUserIdCookieOptions());
    }

    return response;
  } catch (error: any) {
    console.error('[auth/me] Error:', error.message);
    return NextResponse.json({ authenticated: false });
  }
}
