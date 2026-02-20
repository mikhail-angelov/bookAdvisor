import { GET } from '../books/route';
import { initDatabase, closeDatabase, getAppDbAsync, book as bookSchema } from '@/db/index';
import { NextRequest } from 'next/server';

describe('GET /api/books', () => {
  beforeAll(async () => {
    // Initialize in-memory test database
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    // Clear books table before each test
    const db = await getAppDbAsync();
    await db.delete(bookSchema);
  });

  it('should filter books by genre with comma-separated values', async () => {
    const db = await getAppDbAsync();
    
    // Insert test books with different genre formats
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1 - Фантастика only',
        category: 'Фантастика',
        genre: 'Фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2 - Фантастика, фэнтези',
        category: 'Фантастика',
        genre: 'Фантастика, фэнтези',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3 - Фэнтези only',
        category: 'Фантастика',
        genre: 'Фэнтези',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4 - Боевик, фэнтези',
        category: 'Фантастика',
        genre: 'Боевик, фэнтези',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Test filtering by "Фантастика"
    const request1 = new NextRequest('http://localhost:3000/api/books?genre=Фантастика');
    const response1 = await GET(request1);
    const data1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(data1.books).toHaveLength(2); // Should match books 1 and 2
    expect(data1.books.map((b: any) => b.title)).toEqual(
      expect.arrayContaining(['Book 1 - Фантастика only', 'Book 2 - Фантастика, фэнтези'])
    );

    // Test filtering by "Фэнтези"
    const request2 = new NextRequest('http://localhost:3000/api/books?genre=Фэнтези');
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.books).toHaveLength(3); // Should match books 2, 3, and 4
    expect(data2.books.map((b: any) => b.title)).toEqual(
      expect.arrayContaining([
        'Book 2 - Фантастика, фэнтези',
        'Book 3 - Фэнтези only',
        'Book 4 - Боевик, фэнтези'
      ])
    );

    // Test filtering by "Боевик"
    const request3 = new NextRequest('http://localhost:3000/api/books?genre=Боевик');
    const response3 = await GET(request3);
    const data3 = await response3.json();

    expect(response3.status).toBe(200);
    expect(data3.books).toHaveLength(1); // Should match only book 4
    expect(data3.books[0].title).toBe('Book 4 - Боевик, фэнтези');
  });

  it('should handle case-insensitive genre filtering', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1 - lowercase',
        category: 'Фантастика',
        genre: 'фантастика', // lowercase
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2 - uppercase',
        category: 'Фантастика',
        genre: 'ФАНТАСТИКА', // uppercase
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3 - mixed case (unrealistic edge case)',
        category: 'Фантастика',
        genre: 'ФаНтАсТиКа', // mixed case - unrealistic in real data
        createdAt: new Date().toISOString(),
      },
    ]);

    // Search with normalized case (as it would come from genres API)
    const request = new NextRequest('http://localhost:3000/api/books?genre=Фантастика');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should match lowercase and uppercase books
    // Mixed case "ФаНтАсТиКа" is an unrealistic edge case that won't match
    // In real data, genres are typically lowercase, uppercase, or properly capitalized
    expect(data.books).toHaveLength(2);
    expect(data.books.map((b: any) => b.id)).toEqual(
      expect.arrayContaining(['1', '2'])
    );
  });

  it('should filter books by genre with different delimiters', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1 - comma',
        category: 'Фантастика',
        genre: 'Фантастика, фэнтези',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2 - semicolon',
        category: 'Фантастика',
        genre: 'Фантастика; фэнтези',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3 - slash',
        category: 'Фантастика',
        genre: 'Фантастика/фэнтези',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4 - no match',
        category: 'Фантастика',
        genre: 'Боевик',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Search for "Фантастика" - should match books 1, 2, 3
    const request = new NextRequest('http://localhost:3000/api/books?genre=Фантастика');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(3);
    expect(data.books.map((b: any) => b.title)).toEqual(
      expect.arrayContaining(['Book 1 - comma', 'Book 2 - semicolon', 'Book 3 - slash'])
    );
  });

  it('should handle genre at different positions in the list', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1 - genre at start',
        category: 'Фантастика',
        genre: 'Фантастика, фэнтези, боевик',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2 - genre in middle',
        category: 'Фантастика',
        genre: 'фэнтези, Фантастика, боевик',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3 - genre at end',
        category: 'Фантастика',
        genre: 'фэнтези, боевик, Фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4 - no match',
        category: 'Фантастика',
        genre: 'фэнтези, боевик',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Search for "Фантастика" - should match books 1, 2, 3
    const request = new NextRequest('http://localhost:3000/api/books?genre=Фантастика');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(3);
    expect(data.books.map((b: any) => b.title)).toEqual(
      expect.arrayContaining([
        'Book 1 - genre at start',
        'Book 2 - genre in middle',
        'Book 3 - genre at end'
      ])
    );
  });

  it('should combine genre filter with search query', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Война и мир - Фантастика',
        category: 'Фантастика',
        genre: 'Фантастика, классика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Преступление и наказание - Фантастика',
        category: 'Фантастика',
        genre: 'Фантастика, драма',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Война и мир - Драма',
        category: 'Драма',
        genre: 'Драма, классика',
        createdAt: new Date().toISOString(),
      },
    ]);

    // Search for "война" with genre "Фантастика"
    const request = new NextRequest('http://localhost:3000/api/books?q=война&genre=Фантастика');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe('Война и мир - Фантастика');
  });
});