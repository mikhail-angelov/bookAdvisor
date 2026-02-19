import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
import { book } from '@/db/schema';
import { eq, like, or, and, sql, asc, desc } from 'drizzle-orm';

const SORTABLE_COLUMNS = ['title', 'genre', 'seeds', 'downloads', 'lastCommentDate'] as const;
type SortColumn = typeof SORTABLE_COLUMNS[number];

const columnMap: Record<SortColumn, typeof book[keyof typeof book]> = {
  title: book.title,
  genre: book.genre,
  seeds: book.seeds,
  downloads: book.downloads,
  lastCommentDate: book.lastCommentDate,
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const genre = searchParams.get('genre') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const sortBy = (searchParams.get('sortBy') || 'lastCommentDate') as SortColumn;
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

    const db = await getDbAsync();

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

    if (genre) {
      conditions.push(eq(book.genre, genre));
    }

    const col = SORTABLE_COLUMNS.includes(sortBy) ? columnMap[sortBy] : book.lastCommentDate;
    const orderExpr = sortDir === 'asc' ? asc(col as any) : desc(col as any);

    let query = db.select().from(book);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const books = await (query as any).orderBy(orderExpr).limit(limit).offset(offset).all();

    // Total count
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(book);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    const countResult = await countQuery.get();
    const total = countResult?.count ?? 0;

    return NextResponse.json({
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + books.length < total,
      }
    });
  } catch (error) {
    console.error('Fetch books error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
