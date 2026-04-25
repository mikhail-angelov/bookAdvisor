import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { verifySessionToken } from '@/lib/auth';
import { getRecommendationsForUser } from '@/lib/recommendations';
import { getVectorRecommendationsForUser } from '@/lib/recommendations-vector';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const provider = searchParams.get('provider') || 'hybrid';

    let targetUserId: string | null = null;
    const token = req.cookies.get('auth_token')?.value;
    if (token) {
      try {
        const payload = verifySessionToken(token);
        targetUserId = payload.userId;
      } catch {
        // Invalid token, continue without user.
      }
    }

    if (!targetUserId) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please sign in to get personalized recommendations',
      }, { status: 401 });
    }

    const db = await getAppDbAsync();

    if (provider === 'vector') {
      const recommendations = await getVectorRecommendationsForUser(db, targetUserId, limit);
      return NextResponse.json(recommendations);
    }

    // Default: hybrid (classic scoring engine)
    const recommendations = await getRecommendationsForUser(db, targetUserId, { limit });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
