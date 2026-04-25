/**
 * Unit tests for generate-embeddings script.
 *
 * The actual script uses process-level side-effects (db open, stdout), so we
 * test the core operations in isolation by exercising the same functions the
 * script would call: generateEmbedding → serializeEmbedding → db write.
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
      title: overrides.title ?? 'Unembedded Book',
      authorName: overrides.authorName ?? null,
      performer: overrides.performer ?? null,
      genre: overrides.genre ?? null,
      description: overrides.description ?? null,
      url: overrides.url ?? `https://example.com/book/${id}`,
      downloads: overrides.downloads ?? 0,
      size: overrides.size ?? '100 MB',
      seeders: overrides.seeders ?? 0,
      leechers: overrides.leechers ?? 0,
      completed: overrides.completed ?? 0,
      postedAt: overrides.postedAt ?? '2025-01-01',
      updatedAt: overrides.updatedAt ?? null,
      createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
      image: overrides.image ?? null,
      rating: overrides.rating ?? null,
      embedding: null, // explicitly no embedding
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

    // Build text – same logic the script uses
    const text = buildBookText({
      title: 'Test Book',
      authorName: 'Author',
      performer: null,
      genre: 'Fantasy',
      description: null,
    });
    expect(text).toMatch(/Test Book.*Author.*Fantasy/);

    // Generate embedding (mocked in jest.setup.js)
    const vec = await generateEmbedding(text);
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(384);

    // Serialize & store
    const blob = serializeEmbedding(vec);
    await db.update(book).set({ embedding: blob }).where(eq(book.id, id)).run();

    // Verify it was stored
    const updated = await db.select().from(book).where(eq(book.id, id)).get();
    expect(updated?.embedding).toBeDefined();

    // Verify it no longer shows up as unembedded
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
    // Even without extra metadata we get the title
    expect(text).toBe('Bare Minimum');

    const vec = await generateEmbedding(text);
    expect(vec.length).toBe(384);
  });

  it('should skip books with very short text (too little metadata)', async () => {
    const id = await insertBookWithoutEmbedding({
      title: 'Hi', // title too short to be meaningful
    });

    const text = buildBookText({
      title: 'Hi',
      authorName: null,
      performer: null,
      genre: null,
      description: null,
    });
    expect(text.length).toBeLessThan(5);

    // The script would skip this – but the generateEmbedding function
    // still works; the skip logic is in the script itself, not here.
    // Just verify we can still get an embedding even for short text.
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
