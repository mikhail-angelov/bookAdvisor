import { getAppDbAsync } from '@/db/index';
import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema';
import { eq, and, desc, inArray, like, notInArray, or } from 'drizzle-orm';

export type AffinityBand = 'positive' | 'mixed' | 'neutral' | 'negative';

type AppDb = Awaited<ReturnType<typeof getAppDbAsync>>;

const DEFAULT_WEIGHTS = {
  genre: 0.28,
  author: 0.10,
  performer: 0.16,
  performance: 0.14,
  popularity: 0.18,
  recency: 0.14,
};

export interface AuthorAffinityStats {
  interactionCount: number;
  netSentiment: number;
  avgSentiment: number;
  dropCount: number;
}

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

export interface RecommendationOptions {
  limit?: number;
}

export function toAuthorSentiment(annotation: { rating: number; readStatus: string | null }): number | null {
  if (annotation.rating >= 1) {
    return { 1: -2, 2: -1, 3: 0, 4: 1, 5: 2 }[annotation.rating] ?? null;
  }

  if (annotation.readStatus === 'dropped') {
    return -2;
  }

  return null;
}

export function getAuthorAffinityBand(stats: Pick<AuthorAffinityStats, 'netSentiment' | 'interactionCount'>): AffinityBand {
  const avg = stats.interactionCount > 0 ? stats.netSentiment / stats.interactionCount : 0;

  if (avg >= 1.25) return 'positive';
  if (avg > 0) return 'mixed';
  if (avg <= -1) return 'negative';
  return 'neutral';
}

export function getPopularityWeightMultiplier(totalSignals: number): number {
  if (totalSignals <= 1) return 1.35;
  if (totalSignals <= 3) return 1.15;
  return 1;
}

export function applyAuthorDiversityCap<T extends { authorName: string | null }>(
  books: T[],
  limit: number,
  maxPerAuthor: number,
): T[] {
  const seen = new Map<string, number>();
  const result: T[] = [];

  for (const book of books) {
    const key = (book.authorName ?? '').trim().toLowerCase() || `__unknown__:${result.length}`;
    const count = seen.get(key) ?? 0;

    if (count >= maxPerAuthor) {
      continue;
    }

    seen.set(key, count + 1);
    result.push(book);

    if (result.length === limit) {
      break;
    }
  }

  return result;
}

export function extractGenres(genreStr: string | null): string[] {
  if (!genreStr) return [];
  return genreStr
    .split(/[,;/]+/)
    .map(g => g.trim().toLowerCase())
    .filter(g => g.length > 0);
}

async function getUserPreferences(db: AppDb, userId: string): Promise<UserPreferences> {
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
    for (const genre of genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + rating.rating);
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
    likedGenres: Array.from(genreCounts.entries()).sort(sortByCount).slice(0, 10).map(([genre]) => genre),
    likedAuthors,
    likedPerformers: Array.from(performerCounts.entries()).sort(sortByCount).slice(0, 10).map(([performer]) => performer),
    highPerformancePerformers: Array.from(highPerfCounts.entries()).sort(sortByCount).slice(0, 10).map(([performer]) => performer),
    avgRating: positiveRatings.length > 0 ? totalRating / positiveRatings.length : 0,
    avgPerformanceRating: perfCount > 0 ? totalPerfRating / perfCount : 0,
    totalSignals,
    authorAffinity,
  };
}

function calculateScore(
  candidate: { genre: string | null; authorName: string | null; performer: string | null; downloads: number | null; seeds: number | null; year: number | null; lastCommentDate: string | null },
  prefs: UserPreferences,
  weights: typeof DEFAULT_WEIGHTS
): { score: number; reasons: string[] } {
  let genreScore = 0;
  let authorScore = 0;
  let performerScore = 0;
  let performanceScore = 0;
  const reasons: string[] = [];

  const bookGenres = extractGenres(candidate.genre);
  if (bookGenres.length > 0 && prefs.likedGenres.length > 0) {
    const matches = bookGenres.filter(genre => prefs.likedGenres.includes(genre));
    if (matches.length > 0) {
      genreScore = matches.length / Math.max(bookGenres.length, prefs.likedGenres.length);
      reasons.push(`Genre: ${matches[0]}`);
    }
  }

  const affinity = candidate.authorName
    ? prefs.authorAffinity.get(candidate.authorName.toLowerCase().trim())
    : undefined;
  const affinityBand = affinity ? getAuthorAffinityBand(affinity) : 'neutral';

  if (affinityBand === 'positive') {
    authorScore = 0.7;
    reasons.push('Author affinity: positive');
  } else if (affinityBand === 'mixed') {
    authorScore = 0.25;
    reasons.push('Author affinity: mixed');
  } else if (affinityBand === 'negative') {
    authorScore = -0.15;
  }

  if (candidate.performer && prefs.likedPerformers.length > 0) {
    const performer = candidate.performer.toLowerCase().trim();
    if (prefs.likedPerformers.includes(performer)) {
      performerScore = 1;
      reasons.push(`Performer: ${candidate.performer}`);
    }
  }

  if (candidate.performer && prefs.highPerformancePerformers.length > 0) {
    const performer = candidate.performer.toLowerCase().trim();
    if (prefs.highPerformancePerformers.includes(performer)) {
      performanceScore = 1;
      reasons.push(`Great audio: ${candidate.performer}`);
    }
  }

  const maxDownloads = 50000;
  const popularityMultiplier = getPopularityWeightMultiplier(prefs.totalSignals);
  const popularityScore = Math.min((candidate.downloads || 0) / maxDownloads, 1) * popularityMultiplier;

  let recencyScore = 0;
  const currentYear = new Date().getFullYear();
  if (candidate.year) {
    recencyScore = Math.max(0, Math.min((candidate.year - 2000) / (currentYear - 2000), 1));
  } else if (candidate.lastCommentDate) {
    const commentYear = new Date(candidate.lastCommentDate).getFullYear();
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
  db: AppDb,
  prefs: UserPreferences,
  excludeIds: string[],
  limit: number,
): Promise<Book[]> {
  const targetLimit = Math.max(limit * 10, 100); //not optimal, but ok for now
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

export async function getRecommendationsForUser(
  db: AppDb,
  userId: string,
  options: RecommendationOptions = {},
) {
  const limit = options.limit ?? 20;
  const prefs = await getUserPreferences(db, userId);

  const allUserAnnotations = await db
    .select({ bookId: userAnnotation.bookId })
    .from(userAnnotation)
    .where(eq(userAnnotation.userId, userId))
    .all();
  const excludeIds = allUserAnnotations.map((record: { bookId: string }) => record.bookId);

  if (prefs.totalSignals === 0) {
    let popularBooks = await db
      .select()
      .from(book)
      .orderBy(desc(book.downloads))
      .limit(limit * 3)
      .all();

    popularBooks = popularBooks.filter(candidate => !excludeIds.includes(candidate.id));
    popularBooks = popularBooks.slice(0, limit);

    const maxDownloads = popularBooks.length > 0 ? (popularBooks[0].downloads || 1) : 1;
    const scoredBooks = popularBooks.map(candidate => ({
      ...candidate,
      score: (candidate.downloads || 0) / maxDownloads,
      reasons: ['Popular book'],
    }));

    return {
      recommendations: scoredBooks,
      preferences: {
        likedGenres: [],
        likedAuthors: [],
        likedPerformers: [],
        totalLiked: 'No ratings yet',
      },
      message: 'No preferences yet. Showing popular books.',
      reason: 'popular',
    };
  }

  const allBooks = await getHybridCandidates(db, prefs, excludeIds, limit);

  const scoredBooks = allBooks
    .map((currentBook) => {
      const { score, reasons } = calculateScore(currentBook, prefs, DEFAULT_WEIGHTS);
      return { ...currentBook, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const recommendations = applyAuthorDiversityCap(scoredBooks, limit, 2);

  return {
    recommendations,
    preferences: {
      likedGenres: prefs.likedGenres.slice(0, 5),
      likedAuthors: prefs.likedAuthors.slice(0, 5),
      likedPerformers: prefs.likedPerformers.slice(0, 5),
      totalLiked: prefs.likedGenres.length > 0 ? 'Based on your ratings' : 'No ratings yet',
    },
    reason: 'hybrid-scoring',
  };
}
