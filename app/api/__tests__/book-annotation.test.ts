import { NextRequest } from 'next/server';
import { POST } from '../books/[id]/annotation/route';
import { initDatabase, closeDatabase, getAppDbAsync, book, user, userAnnotation } from '@/db/index';
import { createSessionToken } from '@/lib/auth';

describe('POST /api/books/[id]/annotation', () => {
  let authToken: string;

  beforeAll(async () => {
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    const db = await getAppDbAsync();
    await db.delete(userAnnotation);
    await db.delete(book);
    await db.delete(user);

    await db.insert(user).values({
      id: 'user-1',
      email: 'user@example.com',
      createdAt: new Date().toISOString(),
    });

    await db.insert(book).values({
      id: 'book-1',
      url: 'https://example.com/book-1',
      title: 'Book 1',
      category: 'Фантастика',
      createdAt: new Date().toISOString(),
    });

    authToken = createSessionToken('user-1', 'user@example.com');
  });

  it('preserves createdAt when updating an existing annotation', async () => {
    const db = await getAppDbAsync();
    const createdAt = '2024-01-01T00:00:00.000Z';

    await db.insert(userAnnotation).values({
      id: 'annotation-1',
      userId: 'user-1',
      bookId: 'book-1',
      annotation: 'initial',
      rating: 1,
      performanceRating: 1,
      readStatus: 'want_to_read',
      createdAt,
    });

    const request = new NextRequest('http://localhost:3000/api/books/book-1/annotation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `auth_token=${authToken}`,
      },
      body: JSON.stringify({
        annotation: 'updated',
        rating: 5,
        performanceRating: 4,
        readStatus: 'read',
      }),
    });

    const response = await POST(request, { params: { id: 'book-1' } });
    expect(response.status).toBe(200);

    const saved = await db.select().from(userAnnotation).get();
    expect(saved?.annotation).toBe('updated');
    expect(saved?.createdAt).toBe(createdAt);
  });

  it('rejects invalid readStatus values', async () => {
    const request = new NextRequest('http://localhost:3000/api/books/book-1/annotation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `auth_token=${authToken}`,
      },
      body: JSON.stringify({
        annotation: 'updated',
        rating: 5,
        performanceRating: 4,
        readStatus: 'completed',
      }),
    });

    const response = await POST(request, { params: { id: 'book-1' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('readStatus');
  });
});
