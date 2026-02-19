import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/db/index';
import { book } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await getDbAsync();
    const found = await db.select().from(book).where(eq(book.id, params.id)).get();

    if (!found) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ book: found });
  } catch (error) {
    console.error('Fetch book error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
