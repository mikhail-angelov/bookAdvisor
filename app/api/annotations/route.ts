import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { userAnnotation, book } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifySessionToken(token);
    const db = await getAppDbAsync();

    // Get all annotations for the user with book details
    const annotations = await db
      .select({
        id: userAnnotation.id,
        rating: userAnnotation.rating,
        performanceRating: userAnnotation.performanceRating,
        annotation: userAnnotation.annotation,
        readStatus: userAnnotation.readStatus,
        startedAt: userAnnotation.startedAt,
        completedAt: userAnnotation.completedAt,
        createdAt: userAnnotation.createdAt,
        book: {
          id: book.id,
          title: book.title,
          authorName: book.authorName,
          authors: book.authors,
          genre: book.genre,
          imageUrl: book.imageUrl,
          seeds: book.seeds,
          downloads: book.downloads,
        },
      })
      .from(userAnnotation)
      .innerJoin(book, eq(userAnnotation.bookId, book.id))
      .where(eq(userAnnotation.userId, payload.userId))
      .all();

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Fetch annotations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}