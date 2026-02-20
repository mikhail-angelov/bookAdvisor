import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { userAnnotation } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifySessionToken(token);
    const db = await getAppDbAsync();

    const annotation = await db.select().from(userAnnotation)
      .where(and(eq(userAnnotation.userId, payload.userId), eq(userAnnotation.bookId, params.id)))
      .get();

    return NextResponse.json({ annotation: annotation || null });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifySessionToken(token);
    const { annotation, rating, readStatus } = await req.json();
    const db = await getAppDbAsync();

    const existing = await db.select().from(userAnnotation)
      .where(and(eq(userAnnotation.userId, payload.userId), eq(userAnnotation.bookId, params.id)))
      .get();

    if (existing) {
      // Update
      await db.update(userAnnotation)
        .set({
          annotation,
          rating,
          readStatus,
          createdAt: new Date().toISOString(), // Or keep original
        })
        .where(eq(userAnnotation.id, existing.id))
        .run();
        
      return NextResponse.json({ message: 'Annotation updated' });
    } else {
      // Insert
      await db.insert(userAnnotation).values({
        id: uuidv4(),
        userId: payload.userId,
        bookId: params.id,
        annotation,
        rating,
        readStatus,
        createdAt: new Date().toISOString(),
      }).run();

      return NextResponse.json({ message: 'Annotation added' });
    }
  } catch (error) {
    console.error('Annotation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
