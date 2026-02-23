import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { book, userAnnotation } from '@/db/schema';
import { eq, like, or, and, sql, asc, desc, notInArray } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';

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
    const excludeAnnotated = searchParams.get('excludeAnnotated') !== 'false'; // Default to true

    const db = await getAppDbAsync();

    // Get authenticated user from session
    let userId: string | null = null;
    const token = req.cookies.get('auth_token')?.value;
    if (token) {
      try {
        const payload = verifySessionToken(token);
        userId = payload.userId;
      } catch {
        // Invalid token, continue without user
      }
    }

    // Get books that user has annotated (to exclude)
    let annotatedBookIds: string[] = [];
    if (userId && excludeAnnotated) {
      const annotations = await db
        .select({ bookId: userAnnotation.bookId })
        .from(userAnnotation)
        .where(eq(userAnnotation.userId, userId))
        .all();
      annotatedBookIds = annotations.map((a) => a.bookId);
    }

    const conditions = [];

    if (q) {
      // For case-insensitive search with Cyrillic, we need to handle multiple case variations
      // Since SQLite LIKE is case-sensitive for Unicode, we check for common case variations
      const lowerQ = q.toLowerCase();
      const upperQ = q.toUpperCase();
      const capitalizedQ = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
      
      conditions.push(
        or(
          // Check for exact match (case-sensitive)
          like(book.title, `%${q}%`),
          like(book.authorName, `%${q}%`),
          like(book.series, `%${q}%`),
          // Check for lowercase version
          like(book.title, `%${lowerQ}%`),
          like(book.authorName, `%${lowerQ}%`),
          like(book.series, `%${lowerQ}%`),
          // Check for uppercase version  
          like(book.title, `%${upperQ}%`),
          like(book.authorName, `%${upperQ}%`),
          like(book.series, `%${upperQ}%`),
          // Check for capitalized version
          like(book.title, `%${capitalizedQ}%`),
          like(book.authorName, `%${capitalizedQ}%`),
          like(book.series, `%${capitalizedQ}%`)
        )
      );
    }

    if (genre) {
      // Match genre as a separate item in comma/semicolon/slash-separated lists
      // We need to handle case-insensitive matching for Cyrillic characters
      // SQLite LIKE is case-sensitive for Unicode and LOWER() doesn't work well with Cyrillic
      // So we check for multiple case variations
      
      // The genre from the API is normalized (capitalized first letter)
      // We'll check for multiple case variations to handle different data in DB
      const normalizedGenre = genre; // As returned by genres API: "Фантастика"
      const lowerGenre = genre.toLowerCase(); // "фантастика"
      const upperGenre = genre.toUpperCase(); // "ФАНТАСТИКА"
      
      // Helper to create case-insensitive patterns
      const createPatterns = (searchGenre: string) => [
        // Exact match
        sql`${book.genre} = ${searchGenre}`,
        // Genre at start followed by delimiter
        sql`${book.genre} LIKE ${searchGenre + ',%'}`,
        sql`${book.genre} LIKE ${searchGenre + ', %'}`,
        sql`${book.genre} LIKE ${searchGenre + ';%'}`,
        sql`${book.genre} LIKE ${searchGenre + '; %'}`,
        sql`${book.genre} LIKE ${searchGenre + '/%'}`,
        sql`${book.genre} LIKE ${searchGenre + '/ %'}`,
        // Genre in middle with delimiters
        sql`${book.genre} LIKE ${'%,' + searchGenre + ',%'}`,
        sql`${book.genre} LIKE ${'%, ' + searchGenre + ',%'}`,
        sql`${book.genre} LIKE ${'%,' + searchGenre + ', %'}`,
        sql`${book.genre} LIKE ${'%, ' + searchGenre + ', %'}`,
        sql`${book.genre} LIKE ${'%;' + searchGenre + ';%'}`,
        sql`${book.genre} LIKE ${'%; ' + searchGenre + ';%'}`,
        sql`${book.genre} LIKE ${'%;' + searchGenre + '; %'}`,
        sql`${book.genre} LIKE ${'%; ' + searchGenre + '; %'}`,
        sql`${book.genre} LIKE ${'%/' + searchGenre + '/%'}`,
        sql`${book.genre} LIKE ${'%/ ' + searchGenre + '/%'}`,
        sql`${book.genre} LIKE ${'%/' + searchGenre + '/ %'}`,
        sql`${book.genre} LIKE ${'%/ ' + searchGenre + '/ %'}`,
        // Genre at end preceded by delimiter
        sql`${book.genre} LIKE ${'%,' + searchGenre}`,
        sql`${book.genre} LIKE ${'%, ' + searchGenre}`,
        sql`${book.genre} LIKE ${'%;' + searchGenre}`,
        sql`${book.genre} LIKE ${'%; ' + searchGenre}`,
        sql`${book.genre} LIKE ${'%/' + searchGenre}`,
        sql`${book.genre} LIKE ${'%/ ' + searchGenre}`,
      ];
      
      // Check for multiple case variations
      const normalizedPatterns = createPatterns(normalizedGenre);
      const lowerPatterns = createPatterns(lowerGenre);
      const upperPatterns = createPatterns(upperGenre);
      
      // Combine all patterns
      conditions.push(or(...normalizedPatterns, ...lowerPatterns, ...upperPatterns));
    }

    const col = SORTABLE_COLUMNS.includes(sortBy) ? columnMap[sortBy] : book.lastCommentDate;
    const orderExpr = sortDir === 'asc' ? asc(col as any) : desc(col as any);

    // Add exclusion condition for annotated books
    if (annotatedBookIds.length > 0) {
      conditions.push(notInArray(book.id, annotatedBookIds));
    }

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

// Normalize genre for search (same logic as genres API)
function normalizeGenreForSearch(genre: string): string {
  if (!genre || genre.length < 2) return genre;
  
  // Remove leading/trailing punctuation (non-letters, non-digits)
  genre = genre.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+|[^a-zA-Zа-яА-ЯёЁ0-9]+$/g, '');
  
  // For search, we want to match case-insensitively
  // Since SQLite LIKE is case-sensitive for Unicode, we'll lowercase everything
  // This matches the genres API normalization where "фэнтези" becomes "Фэнтези"
  // But for search we want to match both "Фэнтези" and "фэнтези"
  // Actually, let's lowercase to match more cases
  return genre.toLowerCase();
}
