import { NextResponse } from 'next/server';
import { stopCrawl, crawlerState } from '@/lib/crawler';

export async function POST() {
  try {
    if (!crawlerState.isRunning) {
      return NextResponse.json(
        { error: 'Crawler is not running' },
        { status: 400 }
      );
    }

    stopCrawl();

    return NextResponse.json({
      message: 'Crawl stopped',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
