import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyMagicLinkToken, createSessionToken } from '@/lib/auth';

// Force dynamic rendering to prevent any caching
export const dynamic = 'force-dynamic';

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
    console.log('[verify] Created session token for user:', existingUser.id);
    
    // Determine the base URL for redirect (handles proxy/load balancer scenarios)
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    // If behind proxy, use the request's protocol and host from headers
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    console.log('[verify] Forwarded headers - proto:', forwardedProto, 'host:', forwardedHost);
    
    if (forwardedProto && forwardedHost) {
      baseUrl = `${forwardedProto}://${forwardedHost}`;
    } else if (!baseUrl) {
      // Fallback to localhost if no env var set
      baseUrl = "http://localhost:3000";
    }
    
    console.log('[verify] Using baseUrl:', baseUrl);
    
    // Set cookie and redirect
    const response = NextResponse.redirect(new URL('/?logged_in=true', baseUrl));
    
    // Configure cookie for production (behind proxy)
    const isProduction = process.env.NODE_ENV === 'production';
    
    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    response.cookies.set('user_id', existingUser.id, {
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
