import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema';
import { eq, and, desc, inArray, like, notInArray, or } from 'drizzle-orm';
// import { searchSimilar, retrieveVectors } from '@/lib/qdrant';
import { verifySessionToken } from '@/lib/auth';
import {
  getAuthorAffinityBand,
  getPopularityWeightMultiplier,
  toAuthorSentiment,
  type AuthorAffinityStats,
} from '@/lib/recommendations';

/**
 * Recommendation Scoring Algorithm
 * 
 * Score = (genre_match × 25%) + (author_match × 20%) + (performer_match × 15%) + (performance_match × 15%) + (popularity × 15%) + (recency × 10%)
 * 
 * Weights are configurable via query params
 */

// Default weights for scoring
const DEFAULT_WEIGHTS = {
  genre: 0.28,
  author: 0.10,
  performer: 0.16,
  performance: 0.14,
  popularity: 0.18,
  recency: 0.14,
};

interface UserPreferences {
  likedGenres: string[];
  likedAuthors: string[];
  likedPerformers: string[];
  highPerformancePerformers: string[];
  avgRating: number;
  avgPerformanceRating: number;
  totalSignals: number;
  authorAffinity: Map<string, AuthorAffinityStats>;
}

/**
 * Extract unique genres from comma/semicolon/slash separated string
 */
function extractGenres(genreStr: string | null): string[] {
  if (!genreStr) return [];
  return genreStr
    .split(/[,;/]+/)
    .map(g => g.trim().toLowerCase())
    .filter(g => g.length > 0);
}

/**
 * Get user's preferences based on their ratings
 */
async function getUserPreferences(db: ReturnType<typeof getAppDbAsync> extends Promise<infer T> ? T : never, userId: string): Promise<UserPreferences> {
  const allAnnotations = await db
    .select()
    .from(userAnnotation)
    .where(eq(userAnnotation.userId, userId))
    .all() as UserAnnotation[];

  if (allAnnotations.length === 0) {
    return {
      likedGenres: [],
      likedAuthors: [],
      likedPerformers: [],
      highPerformancePerformers: [],
      avgRating: 0,
      avgPerformanceRating: 0,
      totalSignals: 0,
      authorAffinity: new Map(),
    };
  }

  const positiveRatings = allAnnotations.filter((annotation) => annotation.rating >= 4);

  const bookIds = allAnnotations.map((annotation) => annotation.bookId);
  if (bookIds.length === 0) {
    return {
      likedGenres: [],
      likedAuthors: [],
      likedPerformers: [],
      highPerformancePerformers: [],
      avgRating: 0,
      avgPerformanceRating: 0,
      totalSignals: 0,
      authorAffinity: new Map(),
    };
  }

  const books = await db
    .select()
    .from(book)
    .where(inArray(book.id, bookIds))
    .all() as Book[];

  const bookMap = new Map<string, Book>(books.map((item) => [item.id, item]));
  const authorAffinity = new Map<string, AuthorAffinityStats>();
  let totalSignals = 0;

  for (const annotation of allAnnotations) {
    const sentiment = toAuthorSentiment(annotation);
    if (sentiment === null) {
      continue;
    }

    totalSignals += 1;

    const currentBook = bookMap.get(annotation.bookId);
    if (!currentBook?.authorName) continue;

    const author = currentBook.authorName.toLowerCase().trim();
    if (!author || author === 'unknown') continue;

    const stats = authorAffinity.get(author) ?? {
      interactionCount: 0,
      netSentiment: 0,
      avgSentiment: 0,
      dropCount: 0,
    };

    if (annotation.readStatus === 'dropped') {
      stats.dropCount += 1;
    }

    stats.interactionCount += 1;
    stats.netSentiment += sentiment;
    stats.avgSentiment = stats.netSentiment / stats.interactionCount;

    authorAffinity.set(author, stats);
  }

  // Aggregate preferences
  const genreCounts = new Map<string, number>();
  const performerCounts = new Map<string, number>();
  const highPerfCounts = new Map<string, number>();
  let totalRating = 0;
  let totalPerfRating = 0;
  let perfCount = 0;

  for (const rating of positiveRatings) {
    const currentBook = bookMap.get(rating.bookId);
    if (!currentBook) continue;

    totalRating += rating.rating;

    const genres = extractGenres(currentBook.genre);
    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + rating.rating);
    }

    if (currentBook.performer) {
      const performer = currentBook.performer.toLowerCase().trim();
      if (performer && performer !== 'unknown') {
        performerCounts.set(performer, (performerCounts.get(performer) || 0) + rating.rating);
      }
    }

    if (rating.performanceRating && rating.performanceRating >= 4) {
      totalPerfRating += rating.performanceRating;
      perfCount++;
      if (currentBook.performer) {
        const performer = currentBook.performer.toLowerCase().trim();
        if (performer && performer !== 'unknown') {
          highPerfCounts.set(performer, (highPerfCounts.get(performer) || 0) + rating.performanceRating);
        }
      }
    }
  }

  const sortByCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
  const likedAuthors = Array.from(authorAffinity.entries())
    .filter(([, stats]) => getAuthorAffinityBand(stats) !== 'negative')
    .sort((a, b) => b[1].netSentiment - a[1].netSentiment)
    .slice(0, 10)
    .map(([author]) => author);

  return {
    likedGenres: Array.from(genreCounts.entries()).sort(sortByCount).slice(0, 10).map(([g]) => g),
    likedAuthors,
    likedPerformers: Array.from(performerCounts.entries()).sort(sortByCount).slice(0, 10).map(([p]) => p),
    highPerformancePerformers: Array.from(highPerfCounts.entries()).sort(sortByCount).slice(0, 10).map(([p]) => p),
    avgRating: positiveRatings.length > 0 ? totalRating / positiveRatings.length : 0,
    avgPerformanceRating: perfCount > 0 ? totalPerfRating / perfCount : 0,
    totalSignals,
    authorAffinity,
  };
}

/**
 * Calculate recommendation score for a book
 */
function calculateScore(
  book: { genre: string | null; authorName: string | null; performer: string | null; downloads: number | null; seeds: number | null; year: number | null; lastCommentDate: string | null },
  prefs: UserPreferences,
  weights: typeof DEFAULT_WEIGHTS
): { score: number; reasons: string[] } {
  let genreScore = 0;
  let authorScore = 0;
  let performerScore = 0;
  let performanceScore = 0;
  const reasons: string[] = [];

  // Genre match (25%)
  const bookGenres = extractGenres(book.genre);
  if (bookGenres.length > 0 && prefs.likedGenres.length > 0) {
    const matches = bookGenres.filter(g => prefs.likedGenres.includes(g));
    if (matches.length > 0) {
      genreScore = matches.length / Math.max(bookGenres.length, prefs.likedGenres.length);
      reasons.push(`Genre: ${matches[0]}`);
    }
  }

  const affinity = book.authorName
    ? prefs.authorAffinity.get(book.authorName.toLowerCase().trim())
    : undefined;
  const affinityBand = affinity ? getAuthorAffinityBand(affinity) : 'neutral';

  if (affinityBand === 'positive') {
    authorScore = 0.7;
    reasons.push('Author affinity: positive');
  } else if (affinityBand === 'mixed') {
    authorScore = 0.25;
    reasons.push('Author affinity: mixed');
  } else if (affinityBand === 'neutral' && affinity?.dropCount) {
    authorScore = -0.05;
  } else if (affinityBand === 'negative') {
    authorScore = -0.15;
  }

  // Performer match (15%)
  if (book.performer && prefs.likedPerformers.length > 0) {
    const performer = book.performer.toLowerCase().trim();
    if (prefs.likedPerformers.includes(performer)) {
      performerScore = 1;
      reasons.push(`Performer: ${book.performer}`);
    }
  }

  // Performance match (15%) - based on user's high performance ratings
  if (book.performer && prefs.highPerformancePerformers.length > 0) {
    const performer = book.performer.toLowerCase().trim();
    if (prefs.highPerformancePerformers.includes(performer)) {
      performanceScore = 1;
      reasons.push(`Great audio: ${book.performer}`);
    }
  }

  // Popularity score (15%) - normalize downloads to 0-1
  const maxDownloads = 50000; // approximate max
  const popularityMultiplier = getPopularityWeightMultiplier(prefs.totalSignals);
  const popularityScore = Math.min((book.downloads || 0) / maxDownloads, 1) * popularityMultiplier;

  // Recency score (10%) - based on year or last comment
  let recencyScore = 0;
  const currentYear = new Date().getFullYear();
  if (book.year) {
    recencyScore = Math.max(0, Math.min((book.year - 2000) / (currentYear - 2000), 1));
  } else if (book.lastCommentDate) {
    const commentYear = new Date(book.lastCommentDate).getFullYear();
    recencyScore = Math.max(0, Math.min((commentYear - 2000) / (currentYear - 2000), 1));
  }

  if (popularityScore >= 0.1) {
    reasons.push('Popular with readers');
  }

  const totalScore =
    (genreScore * weights.genre) +
    (authorScore * weights.author) +
    (performerScore * weights.performer) +
    (performanceScore * weights.performance) +
    (popularityScore * weights.popularity) +
    (recencyScore * weights.recency);

  return { score: totalScore, reasons };
}

function caseVariants(value: string): string[] {
  const lower = value.toLowerCase();
  const upper = value.toUpperCase();
  const capitalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

  return Array.from(new Set([value, lower, upper, capitalized])).filter(Boolean);
}

async function getHybridCandidates(
  db: ReturnType<typeof getAppDbAsync> extends Promise<infer T> ? T : never,
  prefs: UserPreferences,
  excludeIds: string[],
  limit: number,
): Promise<Book[]> {
  const targetLimit = Math.max(limit * 10, 100);
  const seen = new Map<string, Book>();
  const baseFilters = excludeIds.length > 0 ? [notInArray(book.id, excludeIds)] : [];
  const authorSeeds = prefs.likedAuthors
    .filter((author) => {
      const stats = prefs.authorAffinity.get(author);
      return stats ? getAuthorAffinityBand(stats) !== 'negative' : false;
    })
    .slice(0, 2)
    .flatMap((author) => caseVariants(author).map((variant) => like(book.authorName, `%${variant}%`)));

  const preferenceFilters = [
    ...prefs.likedPerformers.slice(0, 5).flatMap((performer) =>
      caseVariants(performer).map((variant) => like(book.performer, `%${variant}%`)),
    ),
    ...prefs.likedGenres.slice(0, 8).flatMap((genre) =>
      caseVariants(genre).map((variant) => like(book.genre, `%${variant}%`)),
    ),
    ...authorSeeds,
  ];

  if (preferenceFilters.length > 0) {
    let matchedQuery = db
      .select()
      .from(book);

    const matchedCondition = and(...baseFilters, or(...preferenceFilters));
    if (matchedCondition) {
      matchedQuery = matchedQuery.where(matchedCondition) as typeof matchedQuery;
    }

    const matchedBooks = await matchedQuery
      .orderBy(desc(book.downloads))
      .limit(targetLimit)
      .all();

    for (const candidate of matchedBooks) {
      seen.set(candidate.id, candidate);
    }
  }

  let popularQuery = db
    .select()
    .from(book);

  const popularCondition = and(...baseFilters);
  if (popularCondition) {
    popularQuery = popularQuery.where(popularCondition) as typeof popularQuery;
  }

  const popularFallback = await popularQuery
    .orderBy(desc(book.downloads))
    .limit(targetLimit)
    .all();

  for (const candidate of popularFallback) {
    if (!seen.has(candidate.id)) {
      seen.set(candidate.id, candidate);
    }
  }

  return Array.from(seen.values());
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const provider = searchParams.get('provider') || 'hybrid'; // 'hybrid' or 'vector'

    // Get authenticated user from session
    let targetUserId: string | null = null;
    const token = req.cookies.get('auth_token')?.value;
    if (token) {
      try {
        const payload = verifySessionToken(token);
        targetUserId = payload.userId;
      } catch {
        // Invalid token, continue without user
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        message: 'Please sign in to get personalized recommendations' 
      }, { status: 401 });
    }

    const db = await getAppDbAsync();

    // Get user's preferences
    const prefs = await getUserPreferences(db, targetUserId);

    // Get ALL books the user has annotated (to exclude them from recommendations)
    const allUserAnnotations = await db
      .select({ bookId: userAnnotation.bookId })
      .from(userAnnotation)
      .where(eq(userAnnotation.userId, targetUserId))
      .all();
    const excludeIds = allUserAnnotations.map((r: { bookId: string }) => r.bookId);

    // If no preferences yet, return popular books (excluding annotated ones)
    if (prefs.likedGenres.length === 0 && prefs.likedAuthors.length === 0) {
      // Return popular books as default recommendations, excluding annotated books
      let popularBooks = await db
        .select()
        .from(book)
        .orderBy(desc(book.downloads))
        .limit(limit * 3) // Fetch more to account for exclusions
        .all();

      // Filter out annotated books
      popularBooks = popularBooks.filter(b => !excludeIds.includes(b.id));

      // Take only the requested limit
      popularBooks = popularBooks.slice(0, limit);

      // Add score based on normalized downloads for popular books
      const maxDownloads = popularBooks.length > 0 ? (popularBooks[0].downloads || 1) : 1;
      const scoredBooks = popularBooks.map(b => ({
        ...b,
        score: (b.downloads || 0) / maxDownloads,
        reasons: ['Popular book']
      }));

      return NextResponse.json({
        recommendations: scoredBooks,
        message: 'No preferences yet. Showing popular books.',
        reason: 'popular',
      });
    }

    // if (provider === 'vector') {
    //   try {
    //     // Find liked books (rating >= 4)
    //     const likedBookRecords = await db
    //       .select({ bookId: userAnnotation.bookId })
    //       .from(userAnnotation)
    //       .where(and(
    //         eq(userAnnotation.userId, targetUserId),
    //         sql`${userAnnotation.rating} >= 4`
    //       ))
    //       .all();

    //     const likedIds = likedBookRecords.map((r: { bookId: string }) => r.bookId);

    //     if (likedIds.length > 0) {
    //       // Retrieve their vectors
    //       const vectors = await retrieveVectors(likedIds);
    //       const validVectors = vectors.filter(v => v && v.length > 0);

    //       if (validVectors.length > 0) {
    //         // Calculate average vector (centroid)
    //         const vectorSize = validVectors[0].length;
    //         const centroid = new Array(vectorSize).fill(0);
    //         for (const vec of validVectors) {
    //           for (let i = 0; i < vectorSize; i++) {
    //             centroid[i] += vec[i];
    //           }
    //         }
    //         for (let i = 0; i < vectorSize; i++) {
    //           centroid[i] /= validVectors.length;
    //         }

    //         // Query Qdrant
    //         const searchResults = await searchSimilar(centroid, limit, excludeIds);

    //         // Fetch the actual book details from SQLite
    //         const recommendedBookIds = searchResults.map(res => String(res.id));
    //         if (recommendedBookIds.length > 0) {
    //           const recommendedBooks = await db
    //             .select()
    //             .from(book)
    //             .where(inArray(book.id, recommendedBookIds))
    //             .all();

    //           // Sort them to match Qdrant rank
    //           const sortedBooks = recommendedBooks.sort((a, b) => 
    //             recommendedBookIds.indexOf(a.id) - recommendedBookIds.indexOf(b.id)
    //           );

    //           return NextResponse.json({
    //             recommendations: sortedBooks.map(b => ({
    //               ...b,
    //               score: searchResults.find(r => String(r.id) === b.id)?.score || 0,
    //               reasons: ['Similar to books you liked']
    //             })),
    //             preferences: { totalLiked: likedIds.length },
    //             reason: 'vector-similarity',
    //           });
    //         }
    //       }
    //     }
    //   } catch (err) {
    //     console.error('Vector search failed, falling back to hybrid:', err);
    //   }
    // }

    const allBooks = await getHybridCandidates(db, prefs, excludeIds, limit);

    // Score each book
    const scoredBooks = allBooks.map(b => {
      const { score, reasons } = calculateScore(b, prefs, DEFAULT_WEIGHTS);
      return { ...b, score, reasons };
    });

    // Sort by score descending
    scoredBooks.sort((a, b) => b.score - a.score);

    // Take top recommendations
    const recommendations = scoredBooks.slice(0, limit);

    return NextResponse.json({
      recommendations,
      preferences: {
        likedGenres: prefs.likedGenres.slice(0, 5),
        likedAuthors: prefs.likedAuthors.slice(0, 5),
        likedPerformers: prefs.likedPerformers.slice(0, 5),
        totalLiked: prefs.likedGenres.length > 0 ? 'Based on your ratings' : 'No ratings yet',
      },
      reason: 'hybrid-scoring',
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
