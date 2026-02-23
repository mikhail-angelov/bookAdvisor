import { NextRequest, NextResponse } from 'next/server';
import { getAppDbAsync } from '@/db/index';
import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { searchSimilar, retrieveVectors } from '@/lib/qdrant';
import { verifySessionToken } from '@/lib/auth';

/**
 * Recommendation Scoring Algorithm
 * 
 * Score = (genre_match × 25%) + (author_match × 20%) + (performer_match × 15%) + (performance_match × 15%) + (popularity × 15%) + (recency × 10%)
 * 
 * Weights are configurable via query params
 */

// Default weights for scoring
const DEFAULT_WEIGHTS = {
  genre: 0.25,
  author: 0.20,
  performer: 0.15,
  performance: 0.15,
  popularity: 0.15,
  recency: 0.10,
};

interface UserPreferences {
  likedGenres: string[];
  likedAuthors: string[];
  likedPerformers: string[];
  highPerformancePerformers: string[];
  avgRating: number;
  avgPerformanceRating: number;
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
  // Get all annotations with positive ratings (4-5 stars = liked)
  const userRatings = await db
    .select()
    .from(userAnnotation)
    .where(and(
      eq(userAnnotation.userId, userId),
      sql`${userAnnotation.rating} >= 4`
    ))
    .all() as UserAnnotation[];

  if (userRatings.length === 0) {
    return {
      likedGenres: [],
      likedAuthors: [],
      likedPerformers: [],
      highPerformancePerformers: [],
      avgRating: 0,
      avgPerformanceRating: 0,
    };
  }

  // Get book details for rated books
  const bookIds = userRatings.map((r: UserAnnotation) => r.bookId);
  if (bookIds.length === 0) {
    return {
      likedGenres: [],
      likedAuthors: [],
      likedPerformers: [],
      highPerformancePerformers: [],
      avgRating: 0,
      avgPerformanceRating: 0,
    };
  }

  const books = await db
    .select()
    .from(book)
    .all() as Book[];

  // Create a map for quick lookup using books that match our rated book IDs
  const bookMap = new Map<string, Book>();
  for (const b of books) {
    if (bookIds.includes(b.id)) {
      bookMap.set(b.id, b);
    }
  }

  // Aggregate preferences
  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  const performerCounts = new Map<string, number>();
  const highPerfCounts = new Map<string, number>();
  let totalRating = 0;
  let totalPerfRating = 0;
  let perfCount = 0;

  for (const rating of userRatings) {
    const b = bookMap.get(rating.bookId);
    if (!b) continue;

    totalRating += rating.rating;

    // Count genres (weighted by rating)
    const genres = extractGenres(b.genre);
    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + rating.rating);
    }

    // Count authors (weighted by rating)
    if (b.authorName) {
      const author = b.authorName.toLowerCase().trim();
      if (author && author !== 'unknown') {
        authorCounts.set(author, (authorCounts.get(author) || 0) + rating.rating);
      }
    }

    // Count performers (weighted by rating)
    if (b.performer) {
      const performer = b.performer.toLowerCase().trim();
      if (performer && performer !== 'unknown') {
        performerCounts.set(performer, (performerCounts.get(performer) || 0) + rating.rating);
      }
    }

    // Track high performance ratings (4-5 stars)
    if (rating.performanceRating && rating.performanceRating >= 4) {
      totalPerfRating += rating.performanceRating;
      perfCount++;
      if (b.performer) {
        const performer = b.performer.toLowerCase().trim();
        if (performer && performer !== 'unknown') {
          highPerfCounts.set(performer, (highPerfCounts.get(performer) || 0) + rating.performanceRating);
        }
      }
    }
  }

  // Sort by count and take top preferences
  const sortByCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
  
  return {
    likedGenres: Array.from(genreCounts.entries()).sort(sortByCount).slice(0, 10).map(([g]) => g),
    likedAuthors: Array.from(authorCounts.entries()).sort(sortByCount).slice(0, 10).map(([a]) => a),
    likedPerformers: Array.from(performerCounts.entries()).sort(sortByCount).slice(0, 10).map(([p]) => p),
    highPerformancePerformers: Array.from(highPerfCounts.entries()).sort(sortByCount).slice(0, 10).map(([p]) => p),
    avgRating: totalRating / userRatings.length,
    avgPerformanceRating: perfCount > 0 ? totalPerfRating / perfCount : 0,
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

  // Author match (20%)
  if (book.authorName && prefs.likedAuthors.length > 0) {
    const author = book.authorName.toLowerCase().trim();
    if (prefs.likedAuthors.includes(author)) {
      authorScore = 1;
      reasons.push(`Author: ${book.authorName}`);
    }
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
  const popularityScore = Math.min((book.downloads || 0) / maxDownloads, 1);

  // Recency score (10%) - based on year or last comment
  let recencyScore = 0;
  const currentYear = new Date().getFullYear();
  if (book.year) {
    recencyScore = Math.max(0, Math.min((book.year - 2000) / (currentYear - 2000), 1));
  } else if (book.lastCommentDate) {
    const commentYear = new Date(book.lastCommentDate).getFullYear();
    recencyScore = Math.max(0, Math.min((commentYear - 2000) / (currentYear - 2000), 1));
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

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const minRating = parseInt(searchParams.get('minRating') || '0'); // Filter by rating if user wants
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

    // If no preferences yet, return popular books
    if (prefs.likedGenres.length === 0 && prefs.likedAuthors.length === 0) {
      // Return popular books as default recommendations
      const popularBooks = await db
        .select()
        .from(book)
        .orderBy(desc(book.downloads))
        .limit(limit)
        .all();

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

    // Get books that user has already rated (to exclude them)
    const ratedBooks = await db
      .select({ bookId: userAnnotation.bookId })
      .from(userAnnotation)
      .where(eq(userAnnotation.userId, targetUserId))
      .all();
    const ratedBookIds = new Set(ratedBooks.map((r: { bookId: string }) => r.bookId));
    
    // Also filter out books user marked as "dropped"
    const droppedBooks = await db
      .select({ bookId: userAnnotation.bookId })
      .from(userAnnotation)
      .where(and(
        eq(userAnnotation.userId, targetUserId),
        eq(userAnnotation.readStatus, 'dropped')
      ))
      .all();
    const droppedBookIds = new Set(droppedBooks.map((r: { bookId: string }) => r.bookId));

    const excludeIds = [...Array.from(ratedBookIds), ...Array.from(droppedBookIds)];

    if (provider === 'vector') {
      try {
        // Find liked books (rating >= 4)
        const likedBookRecords = await db
          .select({ bookId: userAnnotation.bookId })
          .from(userAnnotation)
          .where(and(
            eq(userAnnotation.userId, targetUserId),
            sql`${userAnnotation.rating} >= 4`
          ))
          .all();

        const likedIds = likedBookRecords.map((r: { bookId: string }) => r.bookId);

        if (likedIds.length > 0) {
          // Retrieve their vectors
          const vectors = await retrieveVectors(likedIds);
          const validVectors = vectors.filter(v => v && v.length > 0);

          if (validVectors.length > 0) {
            // Calculate average vector (centroid)
            const vectorSize = validVectors[0].length;
            const centroid = new Array(vectorSize).fill(0);
            for (const vec of validVectors) {
              for (let i = 0; i < vectorSize; i++) {
                centroid[i] += vec[i];
              }
            }
            for (let i = 0; i < vectorSize; i++) {
              centroid[i] /= validVectors.length;
            }

            // Query Qdrant
            const searchResults = await searchSimilar(centroid, limit, excludeIds);

            // Fetch the actual book details from SQLite
            const recommendedBookIds = searchResults.map(res => String(res.id));
            if (recommendedBookIds.length > 0) {
              const recommendedBooks = await db
                .select()
                .from(book)
                .where(inArray(book.id, recommendedBookIds))
                .all();

              // Sort them to match Qdrant rank
              const sortedBooks = recommendedBooks.sort((a, b) => 
                recommendedBookIds.indexOf(a.id) - recommendedBookIds.indexOf(b.id)
              );

              return NextResponse.json({
                recommendations: sortedBooks.map(b => ({
                  ...b,
                  score: searchResults.find(r => String(r.id) === b.id)?.score || 0,
                  reasons: ['Similar to books you liked']
                })),
                preferences: { totalLiked: likedIds.length },
                reason: 'vector-similarity',
              });
            }
          }
        }
      } catch (err) {
        console.error('Vector search failed, falling back to hybrid:', err);
      }
    }

    // Fetch all books (excluding rated ones)
    // For 20k books, we need to do this in chunks or optimize
    let allBooks = await db
      .select()
      .from(book)
      .all();

    allBooks = allBooks.filter(b => !excludeIds.includes(b.id));

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
