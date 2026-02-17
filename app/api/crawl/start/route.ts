import { NextRequest, NextResponse } from 'next/server';
import { startCrawl, crawlerState } from '@/lib/crawler';

export async function POST(request: NextRequest) {
  try {
    if (crawlerState.isRunning) {
      return NextResponse.json(
        { error: 'Crawler is already running' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { forumId, maxPages } = body;

    if (!forumId) {
      return NextResponse.json(
        { error: 'forumId is required' },
        { status: 400 }
      );
    }

    // Start crawl in background
    startCrawl(forumId, maxPages || 10).catch(console.error);

    return NextResponse.json({
      message: 'Crawl started',
      forumId,
      maxPages: maxPages || 10,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
