import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
import { book } from '@/db/schema';
import { isNotNull, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const db = await getDbAsync();
    const rows = await db
      .selectDistinct({ genre: book.genre })
      .from(book)
      .where(isNotNull(book.genre))
      .orderBy(book.genre)
      .all();

    const genres = rows
      .map(r => r.genre)
      .filter((g): g is string => !!g && g.trim() !== '');

    return NextResponse.json({ genres });
  } catch (error) {
    console.error('Fetch genres error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
