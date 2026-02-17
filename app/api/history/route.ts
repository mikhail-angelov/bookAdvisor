import { NextRequest, NextResponse } from 'next/server';
import { getCrawlHistory } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  console.log('[API /api/history] Request received');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    console.log('[API /api/history] Fetching crawl history with limit:', limit);

    // Use ORM-based queries
    const history = await getCrawlHistory(limit);
    console.log('[API /api/history] Retrieved', history.length, 'history records');

    return NextResponse.json({ data: history });
  } catch (error: any) {
    console.error('[API /api/history] Error:', error);
    console.error('[API /api/history] Stack:', error.stack);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
