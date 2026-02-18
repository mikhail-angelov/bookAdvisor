import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const payload = verifySessionToken(token);
    const db = await getDbAsync();
    
    const existingUser = await db.select().from(user).where(eq(user.id, payload.userId)).get();
    
    if (!existingUser) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}
