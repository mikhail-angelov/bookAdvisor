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

  it('gives only a small author boost when the same author has mixed feedback', async () => {
    const db = await getAppDbAsync();

    await db.insert(bookSchema).values([
      {
        id: 'liked-a1',
        url: 'https://example.com/liked-a1',
        title: 'Author A Hit',
        authorName: 'Author A',
        genre: 'Fantasy',
        category: 'Fantasy',
        downloads: 50,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'dropped-a2',
        url: 'https://example.com/dropped-a2',
        title: 'Author A Miss',
        authorName: 'Author A',
        genre: 'Fantasy',
        category: 'Fantasy',
        downloads: 50,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'candidate-a3',
        url: 'https://example.com/candidate-a3',
        title: 'Author A Candidate',
        authorName: 'Author A',
        genre: 'Fantasy',
        category: 'Fantasy',
        downloads: 100,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'candidate-a4',
        url: 'https://example.com/candidate-a4',
        title: 'Author A Backup',
        authorName: 'Author A',
        genre: 'Fantasy',
        category: 'Fantasy',
        downloads: 95,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'candidate-b1',
        url: 'https://example.com/candidate-b1',
        title: 'Author B Candidate',
        authorName: 'Author B',
        genre: 'Fantasy',
        category: 'Fantasy',
        downloads: 10,
        createdAt: new Date().toISOString(),
      },
    ]);

    await db.insert(userAnnotation).values([
      {
        id: 'ann-liked-a1',
        userId: testUserId,
        bookId: 'liked-a1',
        rating: 5,
        readStatus: 'read',
        createdAt: new Date().toISOString(),
      },
    ]);

    const firstRequest = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
      headers: { cookie: `auth_token=${authToken}` },
    });
    const firstResponse = await GET(firstRequest);
    const firstData = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    const initialAuthorA = firstData.recommendations
      .slice(0, 2)
      .filter((book: any) => book.authorName === 'Author A').length;
    expect(initialAuthorA).toBe(2);

    await db.insert(userAnnotation).values({
      id: 'ann-dropped-a2',
      userId: testUserId,
      bookId: 'dropped-a2',
      rating: 0,
      readStatus: 'dropped',
      createdAt: new Date().toISOString(),
    });

    const secondRequest = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
      headers: { cookie: `auth_token=${authToken}` },
    });
    const secondResponse = await GET(secondRequest);
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    const mixedAuthorA = secondData.recommendations
      .slice(0, 2)
      .filter((book: any) => book.authorName === 'Author A').length;
    expect(mixedAuthorA).toBeLessThan(initialAuthorA);
  });

  it('uses the rating instead of forced dropped sentiment when a dropped book is rated', async () => {
    const db = await getAppDbAsync();

    await db.insert(bookSchema).values([
      {
        id: 'rated-drop-source',
        url: 'https://example.com/rated-drop-source',
        title: 'Rated Drop Source',
        authorName: 'Author Rated',
        genre: 'Mystery',
        category: 'Mystery',
        downloads: 30,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rated-drop-candidate',
        url: 'https://example.com/rated-drop-candidate',
        title: 'Rated Drop Candidate',
        authorName: 'Author Rated',
        genre: 'Mystery',
        category: 'Mystery',
        downloads: 35,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rated-drop-competitor',
        url: 'https://example.com/rated-drop-competitor',
        title: 'Rated Drop Competitor',
        authorName: 'Another Author',
        genre: 'Mystery',
        category: 'Mystery',
        downloads: 45,
        createdAt: new Date().toISOString(),
      },
    ]);

    await db.insert(userAnnotation).values({
      id: 'ann-rated-drop-source',
      userId: testUserId,
      bookId: 'rated-drop-source',
      rating: 4,
      readStatus: 'dropped',
      createdAt: new Date().toISOString(),
    });

    const request = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
      headers: { cookie: `auth_token=${authToken}` },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recommendations[0].id).toBe('rated-drop-candidate');
    expect(data.recommendations[0].score).toBeGreaterThan(0);
    const rankedIds = data.recommendations.map((book: any) => book.id);
    expect(rankedIds.indexOf('rated-drop-candidate')).toBeLessThan(
      rankedIds.indexOf('rated-drop-competitor'),
    );
  });

  it('lets downloads break near-ties and matter more for thin histories', async () => {
    const db = await getAppDbAsync();

    await db.insert(bookSchema).values([
      {
        id: 'history-source',
        url: 'https://example.com/history-source',
        title: 'History Source',
        authorName: 'Source Author',
        genre: 'Sci-Fi',
        category: 'Sci-Fi',
        downloads: 20,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'high-download',
        url: 'https://example.com/high-download',
        title: 'High Download Candidate',
        authorName: 'Candidate Author A',
        genre: 'Sci-Fi',
        category: 'Sci-Fi',
        downloads: 5000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'low-download',
        url: 'https://example.com/low-download',
        title: 'Low Download Candidate',
        authorName: 'Candidate Author B',
        genre: 'Sci-Fi',
        category: 'Sci-Fi',
        downloads: 50,
        createdAt: new Date().toISOString(),
      },
    ]);

    await db.insert(userAnnotation).values({
      id: 'ann-history-source',
      userId: testUserId,
      bookId: 'history-source',
      rating: 5,
      readStatus: 'read',
      createdAt: new Date().toISOString(),
    });

    const firstRequest = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
      headers: { cookie: `auth_token=${authToken}` },
    });
    const firstResponse = await GET(firstRequest);
    const firstData = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstData.recommendations[0].id).toBe('high-download');

    const firstHigh = firstData.recommendations.find((book: any) => book.id === 'high-download');
    const firstLow = firstData.recommendations.find((book: any) => book.id === 'low-download');
    expect(firstHigh).toBeDefined();
    expect(firstLow).toBeDefined();
    const firstGap = firstHigh.score - firstLow.score;
    expect(firstGap).toBeGreaterThan(0);

    await db.insert(bookSchema).values({
      id: 'history-source-2',
      url: 'https://example.com/history-source-2',
      title: 'History Source 2',
      authorName: 'Source Author 2',
      genre: 'Sci-Fi',
      category: 'Sci-Fi',
      downloads: 25,
      createdAt: new Date().toISOString(),
    });

    await db.insert(userAnnotation).values({
      id: 'ann-history-source-2',
      userId: testUserId,
      bookId: 'history-source-2',
      rating: 5,
      readStatus: 'read',
      createdAt: new Date().toISOString(),
    });

    const secondRequest = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
      headers: { cookie: `auth_token=${authToken}` },
    });
    const secondResponse = await GET(secondRequest);
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    const secondHigh = secondData.recommendations.find((book: any) => book.id === 'high-download');
    const secondLow = secondData.recommendations.find((book: any) => book.id === 'low-download');
    expect(secondHigh).toBeDefined();
    expect(secondLow).toBeDefined();
    const secondGap = secondHigh.score - secondLow.score;
    expect(secondGap).toBeLessThan(firstGap);
  });

  it('caps final results to two books per author', async () => {
    const db = await getAppDbAsync();

    await db.insert(bookSchema).values([
      {
        id: 'seed-1',
        url: 'https://example.com/seed-1',
        title: 'Seed 1',
        authorName: 'Seed Author',
        genre: 'Adventure',
        category: 'Adventure',
        downloads: 20,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'author-a-1',
        url: 'https://example.com/author-a-1',
        title: 'Author A 1',
        authorName: 'Author A',
        genre: 'Adventure',
        category: 'Adventure',
        downloads: 1000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'author-a-2',
        url: 'https://example.com/author-a-2',
        title: 'Author A 2',
        authorName: 'Author A',
        genre: 'Adventure',
        category: 'Adventure',
        downloads: 900,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'author-a-3',
        url: 'https://example.com/author-a-3',
        title: 'Author A 3',
        authorName: 'Author A',
        genre: 'Adventure',
        category: 'Adventure',
        downloads: 800,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'author-b-1',
        url: 'https://example.com/author-b-1',
        title: 'Author B 1',
        authorName: 'Author B',
        genre: 'Adventure',
        category: 'Adventure',
        downloads: 700,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'author-c-1',
        url: 'https://example.com/author-c-1',
        title: 'Author C 1',
        authorName: 'Author C',
        genre: 'Adventure',
        category: 'Adventure',
        downloads: 600,
        createdAt: new Date().toISOString(),
      },
    ]);

    await db.insert(userAnnotation).values({
      id: 'ann-seed-1',
      userId: testUserId,
      bookId: 'seed-1',
      rating: 5,
      readStatus: 'read',
      createdAt: new Date().toISOString(),
    });

    const request = new NextRequest('http://localhost:3000/api/recommendations?limit=4', {
      headers: { cookie: `auth_token=${authToken}` },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const authorNames = data.recommendations.map((book: any) => book.authorName);
    expect(authorNames.filter((author) => author === 'Author A')).toHaveLength(2);
    expect(authorNames).toContain('Author C');
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
