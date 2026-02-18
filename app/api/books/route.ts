import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
import { book } from '@/db/schema';
import { eq, like, or, and, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const db = await getDbAsync();

    let query = db.select().from(book);
    
    const conditions = [];
    
    if (q) {
      conditions.push(
        or(
          like(book.title, `%${q}%`),
          like(book.authorName, `%${q}%`),
          like(book.series, `%${q}%`)
        )
      );
    }
    
    if (category) {
      conditions.push(eq(book.category, category));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const books = await query.limit(limit).offset(offset).all();
    
    // Get total count for pagination metadata if needed
    // const totalCount = await db.select({ count: sql<number>`count(*)` }).from(book).where(and(...conditions)).get();

    return NextResponse.json({
      books,
      pagination: {
        page,
        limit,
        hasMore: books.length === limit
      }
    });
  } catch (error) {
    console.error('Fetch books error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
