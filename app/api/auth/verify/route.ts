import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyMagicLinkToken, createSessionToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const payload = verifyMagicLinkToken(token);
    const db = await getAppDbAsync();
    
    const existingUser = await db.select().from(user).where(eq(user.email, payload.email)).get();
    
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create session token
    const sessionToken = createSessionToken(existingUser.id, existingUser.email);
    
    // Set cookie and redirect
    const response = NextResponse.redirect(new URL('/?logged_in=true', process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
    
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    response.cookies.set('user_id', existingUser.id, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
