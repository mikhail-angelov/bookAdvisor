import { NextResponse } from 'next/server';
import { getCrawlerStatus } from '@/lib/crawler';

export async function GET() {
  try {
    const status = getCrawlerStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
