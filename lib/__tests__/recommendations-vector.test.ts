/**
 * Unit tests for vector-based recommendation provider.
 *
 * Uses mocked @xenova/transformers (set up in jest.setup.js).
 */

import { initDatabase, closeDatabase, getAppDbAsync } from '@/db/index';
import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema-app';
import { getVectorRecommendationsForUser, type VectorResult } from '@/lib/recommendations-vector';
import { generateEmbedding, serializeEmbedding } from '@/lib/embeddings-local';
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
    size: null, seeds: 0, leechers: 0, downloads: 100,
    commentsCount: 0, lastCommentDate: null,
    authorPosts: null, topicTitle: null,
    year: null, authors: null, series: null,
    bookNumber: null, editionType: null,
    audioCodec: null, bitrate: null, duration: null,
    imageUrl: null, externalId: null,
    embedding: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  await db.insert(book).values(row).run();
  return id;
}

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
    performanceRating: 0,
    annotation: null,
    readStatus: overrides.readStatus ?? 'read',
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }).run();
}

async function storeEmbedding(bookId: string, text: string): Promise<void> {
  const db = await getAppDbAsync();
  const vec = await generateEmbedding(text);
  await db.update(book).set({ embedding: serializeEmbedding(vec) }).where(eq(book.id, bookId)).run();
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

  describe('getVectorRecommendationsForUser', () => {
    it('should return recommended books based on user profile embedding', async () => {
      const id1 = await insertBook({ title: 'Magic Forest', genre: 'Fantasy', authorName: 'Alice' });
      const id2 = await insertBook({ title: 'Dragon Realm', genre: 'Fantasy', authorName: 'Bob' });
      const id3 = await insertBook({ title: 'Quantum Physics', genre: 'Science', authorName: 'Carol' });
      const id4 = await insertBook({ title: 'Cooking 101', genre: 'Cooking', authorName: 'Dan' });

      await storeEmbedding(id1, 'magic forest dragon wizard fantasy');
      await storeEmbedding(id2, 'dragon realm magic fantasy');
      await storeEmbedding(id3, 'quantum physics science laboratory');
      await storeEmbedding(id4, 'cooking recipes kitchen food');

      await annotate(userId, id1, { rating: 5, readStatus: 'read' });
      await annotate(userId, id2, { rating: 4, readStatus: 'read' });
      await annotate(userId, id3, { rating: 2, readStatus: 'dropped' });

      const db = await getAppDbAsync();
      const result: VectorResult = await getVectorRecommendationsForUser(db, userId, 5);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(result.reason).toBeDefined();
    });

    it('should return empty array when user has no annotations', async () => {
      const id1 = await insertBook({ title: 'Some Book', genre: 'Fiction' });
      await storeEmbedding(id1, 'some book fiction');

      const db = await getAppDbAsync();
      const result: VectorResult = await getVectorRecommendationsForUser(db, userId, 5);
      expect(result.recommendations).toEqual([]);
    });

    it('should exclude books already annotated', async () => {
      const id1 = await insertBook({ title: 'Read Book', genre: 'Fantasy' });
      const id2 = await insertBook({ title: 'New Book', genre: 'Fantasy' });
      await storeEmbedding(id1, 'fantasy read book');
      await storeEmbedding(id2, 'fantasy new book');

      await annotate(userId, id1, { rating: 4, readStatus: 'read' });

      const db = await getAppDbAsync();
      const result: VectorResult = await getVectorRecommendationsForUser(db, userId, 5);
      const ids = result.recommendations.map(r => r.id);
      expect(ids).not.toContain(id1);
    });

    it('should respect limit parameter', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        const id = await insertBook({ title: `Book ${i}`, genre: 'General', authorName: 'Author' });
        ids.push(id);
        await storeEmbedding(id, `book number ${i} general content`);
      }
      await annotate(userId, ids[0], { rating: 4, readStatus: 'read' });

      const db = await getAppDbAsync();
      const result: VectorResult = await getVectorRecommendationsForUser(db, userId, 3);
      expect(result.recommendations.length).toBeLessThanOrEqual(3);
    });
  });
});
