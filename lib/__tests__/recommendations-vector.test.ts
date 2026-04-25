/**
 * Unit tests for vector-based recommendation provider.
 *
 * Uses mocked @xenova/transformers (set up in jest.setup.js).
 */

import { initDatabase, closeDatabase, getAppDbAsync } from '@/db/index';
import { book, userAnnotation, type Book, type UserAnnotation } from '@/db/schema-app';
import { getVectorRecommendations, deserializeEmbedding, cosineSimilarity } from '@/lib/recommendations-vector';
import { generateEmbedding, buildBookText, serializeEmbedding } from '@/lib/embeddings-local';
import { eq } from 'drizzle-orm';

/** Insert a book row with optional embedding (stored as serialized BLOB). */
async function insertBook(overrides: Partial<Book> = {}): Promise<string> {
  const db = await getAppDbAsync();
  const id = overrides.id ?? `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    id,
    title: overrides.title ?? 'Test Book',
    authorName: overrides.authorName ?? 'Test Author',
    performer: overrides.performer ?? null,
    genre: overrides.genre ?? 'Fantasy',
    description: overrides.description ?? null,
    url: overrides.url ?? `https://example.com/book/${id}`,
    downloads: overrides.downloads ?? 100,
    size: overrides.size ?? '500 MB',
    seeders: overrides.seeders ?? 10,
    leechers: overrides.leechers ?? 2,
    completed: overrides.completed ?? 50,
    postedAt: overrides.postedAt ?? '2025-01-01',
    updatedAt: overrides.updatedAt ?? null,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    image: overrides.image ?? null,
    rating: overrides.rating ?? null,
    embedding: overrides.embedding ?? null,
  };
  await db.insert(book).values(row).run();
  return id;
}

/** Insert a user annotation (like / rating / drop). */
async function annotate(
  userId: string,
  bookId: string,
  overrides: Partial<UserAnnotation> = {},
): Promise<void> {
  const db = await getAppDbAsync();
  await db.insert(userAnnotation).values({
    userId,
    bookId,
    rating: overrides.rating ?? 4,
    readStatus: overrides.readStatus ?? 'read',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? null,
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
  // deserializeEmbedding / cosineSimilarity
  // ------------------------------------------------------------------

  describe('deserializeEmbedding', () => {
    it('should round-trip Float32Array through Buffer', () => {
      const original = new Float32Array(384);
      for (let i = 0; i < 384; i++) original[i] = Math.random() - 0.5;
      const buf = serializeEmbedding(original);
      const restored = deserializeEmbedding(buf);
      expect(restored).toBeInstanceOf(Float32Array);
      expect(restored.length).toBe(384);
      for (let i = 0; i < 384; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 5);
      }
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
    });

    it('should return ~0 for orthogonal vectors', () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([0, 1]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([-1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
    });
  });

  // ------------------------------------------------------------------
  // getVectorRecommendations
  // ------------------------------------------------------------------

  describe('getVectorRecommendations', () => {
    it('should return recommended books based on user profile embedding', async () => {
      // Insert 4 books
      const id1 = await insertBook({ title: 'Magic Forest', genre: 'Fantasy', authorName: 'Alice' });
      const id2 = await insertBook({ title: 'Dragon Realm', genre: 'Fantasy', authorName: 'Bob' });
      const id3 = await insertBook({ title: 'Quantum Physics', genre: 'Science', authorName: 'Carol' });
      const id4 = await insertBook({ title: 'Cooking 101', genre: 'Cooking', authorName: 'Dan' });

      // Generate embeddings – the mocked pipeline returns random vectors, but we
      // use *similar* text for the liked books to create a profile bias.
      await generateAndStoreEmbedding(id1, 'magic forest dragon wizard fantasy');
      await generateAndStoreEmbedding(id2, 'dragon realm magic fantasy');
      await generateAndStoreEmbedding(id3, 'quantum physics science laboratory');
      await generateAndStoreEmbedding(id4, 'cooking recipes kitchen food');

      // User liked the fantasy books
      await annotate(userId, id1, { rating: 5, readStatus: 'read' });
      await annotate(userId, id2, { rating: 4, readStatus: 'read' });

      // User dropped a science book (negative author)
      await annotate(userId, id3, { rating: 2, readStatus: 'dropped' });

      const results = await getVectorRecommendations(userId, { limit: 5 });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should contain at least some results
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when user has no annotations', async () => {
      const id1 = await insertBook({ title: 'Some Book', genre: 'Fiction' });
      await generateAndStoreEmbedding(id1, 'some book fiction');

      const results = await getVectorRecommendations(userId, { limit: 5 });
      expect(results).toEqual([]);
    });

    it('should exclude books already annotated', async () => {
      const id1 = await insertBook({ title: 'Read Book', genre: 'Fantasy' });
      const id2 = await insertBook({ title: 'New Book', genre: 'Fantasy' });
      await generateAndStoreEmbedding(id1, 'fantasy read book');
      await generateAndStoreEmbedding(id2, 'fantasy new book');

      await annotate(userId, id1, { rating: 4, readStatus: 'read' });

      const results = await getVectorRecommendations(userId, { limit: 5 });
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

      const results = await getVectorRecommendations(userId, { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  // ------------------------------------------------------------------
  // buildBookText
  // ------------------------------------------------------------------

  describe('buildBookText', () => {
    it('should build text from all available fields', () => {
      const text = buildBookText({
        title: 'Test',
        authorName: 'Author',
        performer: 'Narrator',
        genre: 'Fantasy',
        description: 'A great book',
      });
      expect(text.toLowerCase()).toContain('test');
      expect(text.toLowerCase()).toContain('author');
      expect(text.toLowerCase()).toContain('narrator');
      expect(text.toLowerCase()).toContain('fantasy');
      expect(text.toLowerCase()).toContain('great');
    });

    it('should handle missing optional fields', () => {
      const text = buildBookText({
        title: 'Minimal',
        authorName: null,
        performer: null,
        genre: null,
        description: null,
      });
      expect(text).toBe('Minimal');
    });
  });
});
