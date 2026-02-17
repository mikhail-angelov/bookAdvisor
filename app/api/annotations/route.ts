import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAnnotationsByUser, upsertAnnotation, getAnnotationByUserAndTorrent } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');
    
    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    const annotations = await getAnnotationsByUser(userId, limit);
    
    return NextResponse.json({ data: annotations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    const body = await request.json();
    const { torrentId, rating, annotation, readStatus } = body;
    
    const result = await upsertAnnotation({
      id: uuidv4(),
      userId,
      torrentId,
      rating,
      annotation,
      readStatus,
      startedAt: readStatus === 'reading' ? new Date().toISOString() : undefined,
      completedAt: readStatus === 'completed' ? new Date().toISOString() : undefined,
    });
    
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
