import { GET } from '../recommendations/route';
import { initDatabase, closeDatabase, getAppDbAsync, book as bookSchema, userAnnotation, user } from '@/db/index';
import { NextRequest } from 'next/server';
import { createSessionToken } from '@/lib/auth';

describe('GET /api/recommendations', () => {
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Initialize in-memory test database
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    const db = await getAppDbAsync();
    
    // Clear tables before each test
    await db.delete(userAnnotation);
    await db.delete(bookSchema);
    await db.delete(user);

    // Create test user
    testUserId = 'test-user-1';
    await db.insert(user).values({
      id: testUserId,
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
    });

    // Generate auth token
    authToken = createSessionToken(testUserId, 'test@example.com');
  });

  it('should exclude annotated books from recommendations', async () => {
    const db = await getAppDbAsync();
    
    // Insert test books
    await db.insert(bookSchema).values([
      {
        id: 'book-1',
        url: 'https://example.com/1',
        title: 'Popular Book 1',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 1000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'book-2',
        url: 'https://example.com/2',
        title: 'Popular Book 2',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 900,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'book-3',
        url: 'https://example.com/3',
        title: 'Popular Book 3',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 800,
        createdAt: new Date().toISOString(),
      },
    ]);

    // User has annotated book-1 and book-2
    await db.insert(userAnnotation).values([
      {
        id: 'annotation-1',
        userId: testUserId,
        bookId: 'book-1',
        rating: 5,
        performanceRating: 5,
        readStatus: 'read',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'annotation-2',
        userId: testUserId,
        bookId: 'book-2',
        rating: 0,
        performanceRating: 0,
        readStatus: 'want_to_read',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Request recommendations
    const request = new NextRequest('http://localhost:3000/api/recommendations', {
      headers: {
        cookie: `auth_token=${authToken}`,
      },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toHaveLength(1);
    expect(data.recommendations[0].id).toBe('book-3');
    expect(data.recommendations[0].title).toBe('Popular Book 3');
  });

  it('should exclude books with any readStatus from recommendations', async () => {
    const db = await getAppDbAsync();
    
    // Insert test books
    await db.insert(bookSchema).values([
      {
        id: 'book-read',
        url: 'https://example.com/read',
        title: 'Read Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 1000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'book-reading',
        url: 'https://example.com/reading',
        title: 'Reading Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 900,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'book-want',
        url: 'https://example.com/want',
        title: 'Want to Read Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 800,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'book-new',
        url: 'https://example.com/new',
        title: 'New Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 700,
        createdAt: new Date().toISOString(),
      },
    ]);

    // User has different read statuses
    await db.insert(userAnnotation).values([
      {
        id: 'ann-1',
        userId: testUserId,
        bookId: 'book-read',
        rating: 5,
        readStatus: 'read',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ann-2',
        userId: testUserId,
        bookId: 'book-reading',
        rating: 0,
        readStatus: 'reading',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ann-3',
        userId: testUserId,
        bookId: 'book-want',
        rating: 0,
        readStatus: 'want_to_read',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Request recommendations
    const request = new NextRequest('http://localhost:3000/api/recommendations', {
      headers: {
        cookie: `auth_token=${authToken}`,
      },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toHaveLength(1);
    expect(data.recommendations[0].id).toBe('book-new');
  });

  it('should exclude annotated books from popular fallback when no preferences', async () => {
    const db = await getAppDbAsync();
    
    // Insert test books with varying popularity
    await db.insert(bookSchema).values([
      {
        id: 'most-popular',
        url: 'https://example.com/popular',
        title: 'Most Popular Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 10000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'second-popular',
        url: 'https://example.com/second',
        title: 'Second Popular Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 5000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'third-popular',
        url: 'https://example.com/third',
        title: 'Third Popular Book',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 3000,
        createdAt: new Date().toISOString(),
      },
    ]);

    // User has annotated the most popular book (but no rating >= 4, so no preferences)
    await db.insert(userAnnotation).values({
      id: 'ann-1',
      userId: testUserId,
      bookId: 'most-popular',
      rating: 2, // Low rating, so no preferences derived
      readStatus: 'read',
      createdAt: new Date().toISOString(),
    });

    // Request recommendations
    const request = new NextRequest('http://localhost:3000/api/recommendations', {
      headers: {
        cookie: `auth_token=${authToken}`,
      },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reason).toBe('popular');
    // Should not include the annotated book
    expect(data.recommendations.map((b: any) => b.id)).not.toContain('most-popular');
    // Should include the other books
    expect(data.recommendations.map((b: any) => b.id)).toEqual(
      expect.arrayContaining(['second-popular', 'third-popular'])
    );
  });

  it('should return 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/recommendations');
    const response = await GET(request);
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Authentication required');
  });

  it('should return empty array when all books are annotated', async () => {
    const db = await getAppDbAsync();
    
    // Insert only 2 books
    await db.insert(bookSchema).values([
      {
        id: 'book-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 1000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'book-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: 'Фантастика',
        downloads: 900,
        createdAt: new Date().toISOString(),
      },
    ]);

    // User has annotated both books
    await db.insert(userAnnotation).values([
      {
        id: 'ann-1',
        userId: testUserId,
        bookId: 'book-1',
        rating: 5,
        readStatus: 'read',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ann-2',
        userId: testUserId,
        bookId: 'book-2',
        rating: 4,
        readStatus: 'read',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Request recommendations
    const request = new NextRequest('http://localhost:3000/api/recommendations', {
      headers: {
        cookie: `auth_token=${authToken}`,
      },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations).toHaveLength(0);
  });
});