import axios from 'axios';
import { fetchUrl } from '../fetcher';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('fetchUrl', () => {
  beforeEach(() => {
    delete process.env.FLARESOLVERR_URL;
    jest.clearAllMocks();
  });

  it('does not treat Cloudflare challenge HTML as a successful page fetch', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      data: Buffer.from('<html><title>Just a moment...</title><body>cloudflare</body></html>'),
    });

    const result = await fetchUrl('https://rutracker.org/forum/viewtopic.php?t=123', {
      retryAttempts: 0,
    });

    expect(result.error).toBe('Blocked/challenge HTML received instead of target page');
    expect(result.html).toBe('');
  });

  it('uses FlareSolverr cookies and user-agent for Rutracker requests', async () => {
    process.env.FLARESOLVERR_URL = 'http://flaresolverr:8191/v1';

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        status: 'ok',
        solution: {
          userAgent: 'resolved-agent',
          cookies: [
            { name: 'cf_clearance', value: 'clearance-token' },
            { name: 'bb_session', value: 'session-token' },
          ],
        },
      },
    });

    mockedAxios.get.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      data: Buffer.from('<html><body><a class="torTopic" href="viewtopic.php?t=123">Book</a></body></html>'),
    });

    const result = await fetchUrl('https://rutracker.org/forum/viewtopic.php?t=123', {
      retryAttempts: 0,
    });

    expect(result.error).toBeUndefined();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://flaresolverr:8191/v1',
      expect.objectContaining({
        cmd: 'request.get',
        url: 'https://rutracker.org/forum/viewtopic.php?t=123',
      }),
      expect.any(Object),
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://rutracker.org/forum/viewtopic.php?t=123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'cf_clearance=clearance-token; bb_session=session-token',
          'User-Agent': 'resolved-agent',
        }),
      }),
    );
  });
});
