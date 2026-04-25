/**
 * Unit tests for vector-based recommendation provider.
 *
 * Uses mocked @xenova/transformers (set up in jest.setup.js).
 */

import { initDatabase, closeDatabase, getAppDbAsync } from '@/db/index';
import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema-app';
import { getVectorRecommendationsForUser } from '@/lib/recommendations-vector';
import { generateEmbedding, buildBookText, serializeEmbedding } from '@/lib/embeddings-local';
import { eq } from 'drizzle-orm';

/** Insert a book row with optional embedding. */
async function insertBook(overrides: Partial<Book> = {}): Promise<string> {
  const db = await getAppDbAsync();
  const id = overrides.id ?? `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    id,
    url: overrides.url ?? `https://example.com/book/${id}`,
    title: overrides.title ?? 'Test Book',
    category: overrides.category ?? 'Фантастика',
    authorName: overrides.authorName ?? 'Test Author',
    performer: overrides.performer ?? null,
    genre: overrides.genre ?? 'Fantasy',
    description: overrides.description ?? null,
    size: overrides.size ?? null,
    seeds: overrides.seeds ?? 0,
    leechers: overrides.leechers ?? 0,
    downloads: overrides.downloads ?? 100,
    commentsCount: overrides.commentsCount ?? 0,
    lastCommentDate: overrides.lastCommentDate ?? null,
    authorPosts: overrides.authorPosts ?? null,
    topicTitle: overrides.topicTitle ?? null,
    year: overrides.year ?? null,
    authors: overrides.authors ?? null,
    series: overrides.series ?? null,
    bookNumber: overrides.bookNumber ?? null,
    editionType: overrides.editionType ?? null,
    audioCodec: overrides.audioCodec ?? null,
    bitrate: overrides.bitrate ?? null,
    duration: overrides.duration ?? null,
    imageUrl: overrides.imageUrl ?? null,
    externalId: overrides.externalId ?? null,
    embedding: overrides.embedding ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? null,
  };
  await db.insert(book).values(row).run();
  return id;
}

/** Insert a user annotation. */
async function annotate(
  userId: string,
  bookId: string,
  overrides: Partial<UserAnnotation> = {},
): Promise<void> {
  const db = await getAppDbAsync();
  await db.insert(userAnnotation).values({
    id: `ann_${userId}_${bookId}`,
    userId,
    bookId,
    rating: overrides.rating ?? 4,
    performanceRating: overrides.performanceRating ?? 0,
    annotation: overrides.annotation ?? null,
    readStatus: overrides.readStatus ?? 'read',
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  }).run();
}

async function generateAndStoreEmbedding(bookId: string, text: string): Promise<void> {
  const db = await getAppDbAsync();
  const vec = await generateEmbedding(text);
  const blob = serializeEmbedding(vec);
  await db.update(book).set({ embedding: blob }).where(eq(book.id, bookId)).run();
}

describe('recommendations-vector', () => {
  const userId = 'test_user_vector';

  beforeAll(async () => {
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  afterEach(async () => {
    const db = await getAppDbAsync();
    await db.delete(userAnnotation);
    await db.delete(book);
  });

  // ------------------------------------------------------------------
  // getVectorRecommendationsForUser
  // ------------------------------------------------------------------

  describe('getVectorRecommendationsForUser', () => {
    it('should return recommended books based on user profile embedding', async () => {
      const id1 = await insertBook({ title: 'Magic Forest', genre: 'Fantasy', authorName: 'Alice' });
      const id2 = await insertBook({ title: 'Dragon Realm', genre: 'Fantasy', authorName: 'Bob' });
      const id3 = await insertBook({ title: 'Quantum Physics', genre: 'Science', authorName: 'Carol' });
      const id4 = await insertBook({ title: 'Cooking 101', genre: 'Cooking', authorName: 'Dan' });

      await generateAndStoreEmbedding(id1, 'magic forest dragon wizard fantasy');
      await generateAndStoreEmbedding(id2, 'dragon realm magic fantasy');
      await generateAndStoreEmbedding(id3, 'quantum physics science laboratory');
      await generateAndStoreEmbedding(id4, 'cooking recipes kitchen food');

      // User liked the fantasy books
      await annotate(userId, id1, { rating: 5, readStatus: 'read' });
      await annotate(userId, id2, { rating: 4, readStatus: 'read' });

      // User dropped a science book (negative author)
      await annotate(userId, id3, { rating: 2, readStatus: 'dropped' });

      const results = await getVectorRecommendationsForUser(userId, { limit: 5 });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when user has no annotations', async () => {
      const id1 = await insertBook({ title: 'Some Book', genre: 'Fiction' });
      await generateAndStoreEmbedding(id1, 'some book fiction');

      const results = await getVectorRecommendationsForUser(userId, { limit: 5 });
      expect(results).toEqual([]);
    });

    it('should exclude books already annotated', async () => {
      const id1 = await insertBook({ title: 'Read Book', genre: 'Fantasy' });
      const id2 = await insertBook({ title: 'New Book', genre: 'Fantasy' });
      await generateAndStoreEmbedding(id1, 'fantasy read book');
      await generateAndStoreEmbedding(id2, 'fantasy new book');

      await annotate(userId, id1, { rating: 4, readStatus: 'read' });

      const results = await getVectorRecommendationsForUser(userId, { limit: 5 });
      const ids = results.map((r: any) => r.id);
      expect(ids).not.toContain(id1);
    });

    it('should respect limit parameter', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        const id = await insertBook({ title: `Book ${i}`, genre: 'General', authorName: 'Author' });
        ids.push(id);
        await generateAndStoreEmbedding(id, `book number ${i} general content`);
      }
      // Like first book to get a profile
      await annotate(userId, ids[0], { rating: 4, readStatus: 'read' });

      const results = await getVectorRecommendationsForUser(userId, { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});
