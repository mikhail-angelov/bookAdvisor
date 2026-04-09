import { NextRequest } from 'next/server';
import { GET } from '../recommendations/route';

describe('GET /api/recommendations', () => {
  it('should return 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost:3000/api/recommendations');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Authentication required');
  });
});
