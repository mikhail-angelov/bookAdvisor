import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
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

    const db = await getDbAsync();
    
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
    
    // Send email
    await sendMagicLinkEmail(email, token);

    return NextResponse.json({ message: 'Magic link sent' });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
