/**
 * Unit tests for generate-embeddings script.
 *
 * Tests core operations in isolation: generateEmbedding → serializeEmbedding → db write.
 */

import { initDatabase, closeDatabase, getAppDbAsync } from '@/db/index';
import { book } from '@/db/schema-app';
import { generateEmbedding, buildBookText, serializeEmbedding } from '@/lib/embeddings-local';
import { eq, isNull } from 'drizzle-orm';

describe('generate-embeddings script (core logic)', () => {
  beforeAll(async () => {
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  afterEach(async () => {
    const db = await getAppDbAsync();
    await db.delete(book);
  });

  /** Helper: insert a book without embedding. */
  async function insertBookWithoutEmbedding(overrides: Record<string, any> = {}): Promise<string> {
    const db = await getAppDbAsync();
    const id = overrides.id ?? `no_emb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(book).values({
      id,
      url: overrides.url ?? `https://example.com/book/${id}`,
      title: overrides.title ?? 'Unembedded Book',
      category: overrides.category ?? 'General',
      authorName: overrides.authorName ?? null,
      performer: overrides.performer ?? null,
      genre: overrides.genre ?? null,
      description: overrides.description ?? null,
      size: null, seeds: 0, leechers: 0, downloads: 0,
      commentsCount: 0, lastCommentDate: null,
      authorPosts: null, topicTitle: null,
      year: null, authors: null, series: null,
      bookNumber: null, editionType: null,
      audioCodec: null, bitrate: null, duration: null,
      imageUrl: null, externalId: null,
      embedding: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    }).run();
    return id;
  }

  it('should find books without embeddings', async () => {
    const db = await getAppDbAsync();
    await insertBookWithoutEmbedding({ title: 'Needs Embedding' });
    await insertBookWithoutEmbedding({ title: 'Also Needs' });

    const unembedded = await db.select().from(book).where(isNull(book.embedding)).all();
    expect(unembedded.length).toBe(2);
  });

  it('should generate and store an embedding for a book', async () => {
    const db = await getAppDbAsync();
    const id = await insertBookWithoutEmbedding({
      title: 'Test Book',
      authorName: 'Author',
      genre: 'Fantasy',
    });

    const text = buildBookText({
      title: 'Test Book',
      authorName: 'Author',
      performer: null,
      genre: 'Fantasy',
      description: null,
    });
    expect(text).toMatch(/Test Book/);
    expect(text).toMatch(/Author/);
    expect(text).toMatch(/Fantasy/);

    const vec = await generateEmbedding(text);
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(384);

    const blob = serializeEmbedding(vec);
    await db.update(book).set({ embedding: blob }).where(eq(book.id, id)).run();

    const updated = await db.select().from(book).where(eq(book.id, id)).get();
    expect(updated?.embedding).toBeDefined();

    const unembedded = await db.select().from(book).where(isNull(book.embedding)).all();
    expect(unembedded.find(b => b.id === id)).toBeUndefined();
  });

  it('should handle books with minimal metadata', async () => {
    const id = await insertBookWithoutEmbedding({
      title: 'Bare Minimum',
      authorName: null,
      performer: null,
      genre: null,
      description: null,
    });

    const text = buildBookText({
      title: 'Bare Minimum',
      authorName: null,
      performer: null,
      genre: null,
      description: null,
    });
    expect(text).toMatch(/Bare Minimum/);

    const vec = await generateEmbedding(text);
    expect(vec.length).toBe(384);
  });

  it('should build text that includes performer when present', () => {
    const text = buildBookText({
      title: 'Title',
      authorName: 'Author',
      performer: 'Narrator',
      genre: 'Fiction',
      description: 'Desc',
    });
    expect(text).toContain('Narrator');
  });

  it('should build text that includes description when present', () => {
    const text = buildBookText({
      title: 'Title',
      authorName: null,
      performer: null,
      genre: null,
      description: 'A long description of the book content',
    });
    expect(text).toContain('long description');
  });
});
