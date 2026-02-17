import { NextRequest, NextResponse } from 'next/server';
import { getAllTorrents, countTorrents } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  console.log('[API /api/torrents] Request received');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const forumId = searchParams.get('forumId');
    const sort = searchParams.get('sort') || 'last_updated';
    const order = searchParams.get('order') || 'desc';

    console.log('[API /api/torrents] Query params - page:', page, 'limit:', limit, 'search:', search, 'forumId:', forumId, 'sort:', sort, 'order:', order);

    const offset = (page - 1) * limit;

    // Build query options
    const options: {
      limit: number;
      offset: number;
      search?: string;
      forumId?: number;
      sort?: string;
      order?: string;
    } = {
      limit,
      offset,
      sort,
      order,
    };

    if (search) {
      options.search = search;
    }

    if (forumId) {
      options.forumId = parseInt(forumId);
    }

    // Use ORM-based queries
    console.log('[API /api/torrents] Fetching torrents...');
    const torrents = await getAllTorrents(options);
    console.log('[API /api/torrents] Retrieved', torrents.length, 'torrents');
    
    console.log('[API /api/torrents] Counting total torrents...');
    const total = await countTorrents({ search, forumId: options.forumId });
    console.log('[API /api/torrents] Total count:', total);

    return NextResponse.json({
      data: torrents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[API /api/torrents] Error:', error);
    console.error('[API /api/torrents] Stack:', error.stack);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
