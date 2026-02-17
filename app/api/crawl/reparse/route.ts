import { NextRequest, NextResponse } from 'next/server';
import { reparseCrawlData } from '@/lib/crawler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { forumId } = body;

    if (!forumId) {
      return NextResponse.json(
        { error: 'forumId is required' },
        { status: 400 }
      );
    }

    const result = await reparseCrawlData(forumId);
    
    return NextResponse.json({
      message: 'Reparse completed',
      forumId,
      ...result,
    });
  } catch (error: any) {
    console.error('[REPARSE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}