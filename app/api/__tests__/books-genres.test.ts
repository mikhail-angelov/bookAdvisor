import { GET } from '../books/genres/route';
import { initDatabase, closeDatabase, getAppDbAsync, book as bookSchema } from '@/db/index';
import { eq } from 'drizzle-orm';

describe('GET /api/books/genres', () => {
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

  it('should return empty array when no genres exist', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ genres: [] });
  });

  it('should split comma-separated genres and return unique values', async () => {
    const db = await getAppDbAsync();
    
    // Insert test books with comma-separated genres
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика, фэнтези',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: 'Фэнтези, боевик',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3',
        category: 'Фантастика',
        genre: 'Фантастика',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toContain('Фантастика');
    expect(data.genres).toContain('Фэнтези');
    expect(data.genres).toContain('Боевик');
    expect(data.genres).toHaveLength(3); // Unique values
    expect(data.genres).toEqual(['Боевик', 'Фантастика', 'Фэнтези']); // Sorted alphabetically
  });

  it('should split semicolon-separated genres', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Litrpg; боевая фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: 'Боевая фантастика; попаданцы',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toContain('Litrpg');
    expect(data.genres).toContain('Боевая фантастика');
    expect(data.genres).toContain('Попаданцы');
    expect(data.genres).toHaveLength(3);
  });

  it('should split slash-separated genres', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Аристократия/боевое фэнтези/попаданцы',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toContain('Аристократия');
    expect(data.genres).toContain('Боевое фэнтези');
    expect(data.genres).toContain('Попаданцы');
    expect(data.genres).toHaveLength(3);
  });

  it('should filter out technical metadata', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: '44.1 kHz',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3',
        category: 'Фантастика',
        genre: 'MP3, аудиокнига',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4',
        category: 'Фантастика',
        genre: '1kHz: время чтения: 12 часов',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toContain('Фантастика');
    expect(data.genres).not.toContain('44.1 kHz');
    expect(data.genres).not.toContain('MP3');
    expect(data.genres).not.toContain('Аудиокнига');
    expect(data.genres).not.toContain('1kHz: время чтения: 12 часов');
    expect(data.genres).toHaveLength(1);
  });

  it('should normalize genre capitalization', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'фантастика', // lowercase
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: 'ФЭНТЕЗИ', // uppercase
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3',
        category: 'Фантастика',
        genre: 'ПоПаДанЦы', // mixed case
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toContain('Фантастика'); // First letter uppercase
    expect(data.genres).toContain('Фэнтези'); // First letter uppercase, rest lowercase
    expect(data.genres).toContain('Попаданцы'); // Normalized
    expect(data.genres).toHaveLength(3);
  });

  it('should handle empty and null genres', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3',
        category: 'Фантастика',
        genre: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4',
        category: 'Фантастика',
        genre: '   ',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toEqual(['Фантастика']);
    expect(data.genres).toHaveLength(1);
  });

  it('should filter out strings with colons that contain metadata keywords', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: 'MP3: 128 kbps',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3',
        category: 'Фантастика',
        genre: 'читает: Иван Иванов',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4',
        category: 'Фантастика',
        genre: 'озвучка: студия',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toEqual(['Фантастика']);
    expect(data.genres).toHaveLength(1);
  });

  it('should filter out very short strings and punctuation', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        crawlId: 'crawl-2',
        url: 'https://example.com/2',
        title: 'Book 2',
        category: 'Фантастика',
        genre: ':',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        crawlId: 'crawl-3',
        url: 'https://example.com/3',
        title: 'Book 3',
        category: 'Фантастика',
        genre: ';',
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        crawlId: 'crawl-4',
        url: 'https://example.com/4',
        title: 'Book 4',
        category: 'Фантастика',
        genre: 'a',
        createdAt: new Date().toISOString(),
      },
      {
        id: '5',
        crawlId: 'crawl-5',
        url: 'https://example.com/5',
        title: 'Book 5',
        category: 'Фантастика',
        genre: '..',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toEqual(['Фантастика']);
    expect(data.genres).toHaveLength(1);
  });

  it('should handle mixed delimiters in the same genre field', async () => {
    const db = await getAppDbAsync();
    
    await db.insert(bookSchema).values([
      {
        id: '1',
        crawlId: 'crawl-1',
        url: 'https://example.com/1',
        title: 'Book 1',
        category: 'Фантастика',
        genre: 'Фантастика, фэнтези; попаданцы/литрпг',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.genres).toContain('Фантастика');
    expect(data.genres).toContain('Фэнтези');
    expect(data.genres).toContain('Попаданцы');
    expect(data.genres).toContain('Литрпг');
    expect(data.genres).toHaveLength(4);
  });
});