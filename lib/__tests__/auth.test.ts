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

    await expect(import('../auth')).rejects.toThrow(
      'AUTH_SECRET must be configured before using authentication features.',
    );
  });
});
