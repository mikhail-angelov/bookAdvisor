import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';

// Force dynamic rendering to prevent any caching
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log('[auth/me] Request URL:', req.url);
    console.log('[auth/me] All cookies:', JSON.stringify(req.cookies.getAll()));
    
    const token = req.cookies.get('auth_token')?.value;
    console.log('[auth/me] Token from cookie:', token ? 'present' : 'missing');

    if (!token) {
      console.log('[auth/me] No token in cookies');
      return NextResponse.json({ authenticated: false });
    }

    console.log('[auth/me] Token found, verifying...');
    const payload = verifySessionToken(token);
    console.log('[auth/me] Token verified, userId:', payload.userId);
    
    const db = await getAppDbAsync();
    
    const existingUser = await db.select().from(user).where(eq(user.id, payload.userId)).get();
    
    if (!existingUser) {
      console.log('[auth/me] User not found for userId:', payload.userId);
      return NextResponse.json({ authenticated: false });
    }

    console.log('[auth/me] User found:', existingUser.email);
    return NextResponse.json({
      authenticated: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
      },
    });
  } catch (error: any) {
    console.error('[auth/me] Error:', error.message);
    return NextResponse.json({ authenticated: false });
  }
}
