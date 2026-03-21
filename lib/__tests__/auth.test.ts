describe('auth secret configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows a test-only fallback secret when NODE_ENV is test', async () => {
    const env = process.env as Record<string, string | undefined>;
    delete env.AUTH_SECRET;
    env.NODE_ENV = 'test';

    const auth = await import('../auth');
    const token = auth.createSessionToken('user-1', 'user@example.com');
    const payload = auth.verifySessionToken(token);

    expect(payload.userId).toBe('user-1');
  });

  it('throws when AUTH_SECRET is missing outside tests', async () => {
    const env = process.env as Record<string, string | undefined>;
    delete env.AUTH_SECRET;
    env.NODE_ENV = 'production';

    const auth = await import('../auth');

    expect(() => auth.createSessionToken('user-1', 'user@example.com')).toThrow(
      'AUTH_SECRET must be configured before using authentication features.',
    );
  });

  it('creates a longer-lived session token', async () => {
    const env = process.env as Record<string, string | undefined>;
    delete env.AUTH_SECRET;
    env.NODE_ENV = 'test';

    const auth = await import('../auth');
    const before = Math.floor(Date.now() / 1000);
    const token = auth.createSessionToken('user-1', 'user@example.com');
    const payload = auth.verifySessionToken(token);
    const ttl = (payload.exp ?? before) - before;

    expect(ttl).toBeGreaterThanOrEqual(auth.SESSION_MAX_AGE_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(auth.SESSION_MAX_AGE_SECONDS + 5);
  });

  it('refreshes sessions that are close to expiry', async () => {
    const env = process.env as Record<string, string | undefined>;
    delete env.AUTH_SECRET;
    env.NODE_ENV = 'test';

    const auth = await import('../auth');

    expect(
      auth.shouldRefreshSession({
        userId: 'user-1',
        email: 'user@example.com',
        type: 'session',
        exp: Math.floor(Date.now() / 1000) + auth.SESSION_REFRESH_THRESHOLD_SECONDS - 60,
      }),
    ).toBe(true);

    expect(
      auth.shouldRefreshSession({
        userId: 'user-1',
        email: 'user@example.com',
        type: 'session',
        exp: Math.floor(Date.now() / 1000) + auth.SESSION_REFRESH_THRESHOLD_SECONDS + 60,
      }),
    ).toBe(false);
  });
});
