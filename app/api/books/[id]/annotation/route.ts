import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { userAnnotation } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_READ_STATUS, isReadStatus } from '@/lib/read-status';

function parseRating(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error(`${field} must be an integer between 0 and 5`);
  }

  return value;
}

async function parseAnnotationBody(req: NextRequest) {
  const body = await req.json();
  const annotation = typeof body.annotation === 'string' ? body.annotation : null;
  const rating = parseRating(body.rating ?? 0, 'rating');
  const performanceRating = parseRating(body.performanceRating ?? 0, 'performanceRating');
  const readStatus = body.readStatus ?? DEFAULT_READ_STATUS;

  if (!isReadStatus(readStatus)) {
    throw new Error('readStatus is invalid');
  }

  return {
    annotation,
    rating,
    performanceRating,
    readStatus,
  };
}

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
    const { annotation, rating, performanceRating, readStatus } = await parseAnnotationBody(req);
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
          performanceRating,
          readStatus,
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
        performanceRating,
        readStatus,
        createdAt: new Date().toISOString(),
      }).run();

      return NextResponse.json({ message: 'Annotation added' });
    }
  } catch (error: any) {
    if (error instanceof Error && /must be|invalid/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Annotation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
