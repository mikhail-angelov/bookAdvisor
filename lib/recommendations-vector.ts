/**
 * Vector-based recommendation provider.
 *
 * Uses cosine similarity between the user-profile embedding and
 * every book's pre-computed embedding stored in the SQLite BLOB column.
 *
 * This is imported by the API route when `provider=vector` is selected
 * and embeddings exist in the database.
 */

import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema';
import type { AppDb } from '@/db/index';
import { eq, inArray, desc } from 'drizzle-orm';
import { applyAuthorDiversityCap, extractGenres, getAuthorAffinityBand } from './recommendations';
import {
  generateEmbedding,
  buildBookText,
  buildUserProfileEmbedding,
  cosineSimilarity,
  deserializeEmbedding,
  serializeEmbedding,
} from './embeddings-local';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VectorRecommendation extends Book {
  score: number;
  similarity: number;
  reasons: string[];
}

interface VectorPrefs {
  likedEmbeddings: Float32Array[];
  likedGenreText: string;
  likedAuthorText: string;
  avgRating: number;
  totalRatings: number;
  negativeAuthorNames: string[];
}

export interface VectorResult {
  recommendations: VectorRecommendation[];
  preferences: {
    likedGenres: string[];
    likedAuthors: string[];
    likedPerformers: string[];
  };
  reason: string;
}

// ---------------------------------------------------------------------------
// Preference extraction
// ---------------------------------------------------------------------------

async function getVectorPreferences(
  db: AppDb,
  userId: string,
): Promise<VectorPrefs> {
  const allAnnotations = await db
    .select()
    .from(userAnnotation)
    .where(eq(userAnnotation.userId, userId))
    .all() as UserAnnotation[];

  if (allAnnotations.length === 0) {
    return {
      likedEmbeddings: [],
      likedGenreText: '',
      likedAuthorText: '',
      avgRating: 0,
      totalRatings: 0,
      negativeAuthorNames: [],
    };
  }

  const bookIds = allAnnotations.map(a => a.bookId);
  const books = await db
    .select()
    .from(book)
    .where(inArray(book.id, bookIds))
    .all() as Book[];

  const bookMap = new Map(books.map(b => [b.id, b]));

  const positive: Book[] = [];
  const negativeAuthors = new Set<string>();

  for (const ann of allAnnotations) {
    const b = bookMap.get(ann.bookId);
    if (!b) continue;

    if (ann.rating >= 4 && b.embedding) {
      positive.push(b);
    }

    // Track authors with negative affinity
    if (ann.readStatus === 'dropped' && ann.rating < 3 && b.authorName) {
      negativeAuthors.add(b.authorName.toLowerCase().trim());
    }
  }

  // Build profile embedding from liked books
  const likedEmbeddings: Float32Array[] = [];
  const likedGenres = new Set<string>();
  const likedAuthors = new Set<string>();

  for (const b of positive) {
    if (b.embedding) {
      likedEmbeddings.push(deserializeEmbedding(b.embedding));
    }
    for (const g of extractGenres(b.genre)) likedGenres.add(g);
    if (b.authorName) likedAuthors.add(b.authorName.toLowerCase().trim());
  }

  const likedGenreText = Array.from(likedGenres).slice(0, 5).join(', ');
  const likedAuthorText = Array.from(likedAuthors).slice(0, 5).join(', ');

  return {
    likedEmbeddings,
    likedGenreText,
    likedAuthorText,
    avgRating: allAnnotations.reduce((s, a) => s + a.rating, 0) / allAnnotations.length,
    totalRatings: allAnnotations.length,
    negativeAuthorNames: Array.from(negativeAuthors),
  };
}

// ---------------------------------------------------------------------------
// Vector-based scoring
// ---------------------------------------------------------------------------

function vectorScore(
  candidate: Book,
  profileEmb: Float32Array,
  prefs: VectorPrefs,
): { score: number; similarity: number; reasons: string[] } {
  const reasons: string[] = [];

  if (!candidate.embedding) {
    return { score: 0, similarity: 0, reasons: ['No embedding'] };
  }

  const candEmb = deserializeEmbedding(candidate.embedding);
  const sim = cosineSimilarity(profileEmb, candEmb);

  // Penalty for negative authors
  if (
    candidate.authorName &&
    prefs.negativeAuthorNames.includes(candidate.authorName.toLowerCase().trim())
  ) {
    return { score: sim * 0.3, similarity: sim, reasons: ['Low author affinity'] };
  }

  // Bonus for known genres/authors
  if (prefs.likedGenreText && candidate.genre) {
    const bookGenres = extractGenres(candidate.genre);
    const match = bookGenres.some(g => prefs.likedGenreText.includes(g));
    if (match) reasons.push('Genre match');
  }

  if (
    prefs.totalRatings >= 3 &&
    candidate.downloads &&
    candidate.downloads > 1000
  ) {
    reasons.push('Popular');
  }

  // Blend similarity with a small popularity bump so fresh users see reasonable results
  const popBoost = candidate.downloads
    ? Math.min(candidate.downloads / 50000, 1) * 0.1
    : 0;

  return {
    score: sim + popBoost,
    similarity: sim,
    reasons: reasons.length > 0 ? reasons : ['Similar to your taste'],
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function getVectorRecommendationsForUser(
  db: AppDb,
  userId: string,
  limit: number = 20,
): Promise<VectorResult> {
  const prefs = await getVectorPreferences(db, userId);

  // No ratings → fallback: popular books
  if (prefs.totalRatings === 0) {
    const popular = await db
      .select()
      .from(book)
      .orderBy(desc(book.downloads))
      .limit(limit)
      .all() as Book[];

    return {
      recommendations: popular.map(b => ({
        ...b,
        score: b.downloads ? Math.min(b.downloads / 50000, 1) : 0,
        similarity: 0,
        reasons: ['Popular book'],
      })),
      preferences: { likedGenres: [], likedAuthors: [], likedPerformers: [] },
      reason: 'popular',
    };
  }

  // Build user profile embedding
  const profileEmb = prefs.likedEmbeddings.length > 0
    ? await buildUserProfileEmbedding(prefs.likedEmbeddings)
    : await buildUserProfileEmbedding([]);

  // If profile embedding is zero (no liked books with embeddings), fallback
  let isZero = true;
  for (let i = 0; i < 384; i++) {
    if (profileEmb[i] !== 0) { isZero = false; break; }
  }

  if (isZero) {
    // Fallback: semantic query from liked genres
    const queryText = [prefs.likedGenreText, prefs.likedAuthorText]
      .filter(Boolean)
      .join('. ') || 'popular books';
    const fallbackEmb = await generateEmbedding(queryText);

    const popular = await db
      .select()
      .from(book)
      .orderBy(desc(book.downloads))
      .limit(limit * 3)
      .all() as Book[];

    const scored = popular
      .filter(b => b.embedding)
      .map(b => ({
        ...b,
        similarity: cosineSimilarity(fallbackEmb, deserializeEmbedding(b.embedding!)),
        score: 0,
        reasons: [] as string[],
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(b => ({
        ...b,
        score: b.similarity,
        reasons: b.reasons.length > 0 ? b.reasons : ['Genre/author similarity'],
      }));

    return {
      recommendations: scored,
      preferences: { likedGenres: [], likedAuthors: [], likedPerformers: [] },
      reason: 'vector-fallback',
    };
  }

  // Get exclude list
  const allAnnotations = await db
    .select({ bookId: userAnnotation.bookId })
    .from(userAnnotation)
    .where(eq(userAnnotation.userId, userId))
    .all();
  const excludeIds = new Set(allAnnotations.map(a => a.bookId));

  // Score all books with embeddings
  const allBooks = await db
    .select()
    .from(book)
    .all() as Book[];

  const scored = allBooks
    .filter(b => b.embedding && !excludeIds.has(b.id))
    .map(b => {
      const { score, similarity, reasons } = vectorScore(b, profileEmb, prefs);
      return { ...b, score, similarity, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const recommendations = applyAuthorDiversityCap(scored, limit, 2);

  return {
    recommendations,
    preferences: {
      likedGenres: [],
      likedAuthors: [],
      likedPerformers: [],
    },
    reason: 'vector',
  };
}
