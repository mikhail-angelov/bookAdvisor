import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createMagicLinkToken, sendMagicLinkEmail } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const db = await getAppDbAsync();
    
    // Check if user exists, if not create them
    let existingUser = await db.select().from(user).where(eq(user.email, email)).get();
    
    if (!existingUser) {
      existingUser = {
        id: uuidv4(),
        email: email,
        username: email.split('@')[0],
        createdAt: new Date().toISOString(),
      };
      await db.insert(user).values(existingUser).run();
    }

    // Generate token
    const token = createMagicLinkToken(email);
    
    // Determine the base URL for the verification link (handles proxy/load balancer scenarios)
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    // If behind proxy, use the request's protocol and host from headers
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    
    if (forwardedProto && forwardedHost) {
      baseUrl = `${forwardedProto}://${forwardedHost}`;
    }
    
    // Send email with the correct base URL
    await sendMagicLinkEmail(email, token, baseUrl);

    return NextResponse.json({ message: 'Magic link sent' });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
