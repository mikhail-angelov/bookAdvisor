import { CrawlerFetcher } from "../fetcher";
import type { FlareSolveResult } from "../flare-client";
import type { Session } from "../session-store";

class FakeFlareClient {
  solve = jest.fn<Promise<FlareSolveResult>, [string]>();
}

class FakeSessionStore {
  private session: Session | null = null;
  get = jest.fn(async () => this.session);
  set = jest.fn(async (_domain: string, session: Session) => {
    this.session = session;
  });
  invalidate = jest.fn(async () => {
    this.session = null;
  });
}

describe("CrawlerFetcher", () => {
  beforeEach(() => {
    delete process.env.FLARESOLVERR_PROXY;
    jest.restoreAllMocks();
  });

  it("does not treat Cloudflare challenge HTML as a successful page fetch", async () => {
    const flare = new FakeFlareClient();
    const store = new FakeSessionStore();
    const fetcher = new CrawlerFetcher(flare as any, store as any);

    flare.solve.mockResolvedValue({
      html: '<html><title>Just a moment...</title><body>cloudflare</body></html>',
      cookieHeader: "cf_clearance=clearance-token",
      userAgent: "resolved-agent",
      status: 200,
    });

    await expect(
      fetcher.fetchHtml("https://rutracker.org/forum/viewtopic.php?t=123", {
        minDelayMs: 0,
        jitterMs: 0,
      }),
    ).rejects.toThrow("FlareSolverr could not get past the Cloudflare challenge");
  });

  it("does not treat Chromium network error HTML as a successful page fetch", async () => {
    const flare = new FakeFlareClient();
    const store = new FakeSessionStore();
    const fetcher = new CrawlerFetcher(flare as any, store as any);

    flare.solve.mockResolvedValue({
      html: [
        '<html dir="ltr" lang="en">',
        "<head><title>rutracker.org</title></head>",
        "<body>",
        "<div id=\"main-frame-error\">This site can't be reached</div>",
        "<div class=\"error-code\">ERR_CONNECTION_CLOSED</div>",
        "</body></html>",
      ].join(""),
      cookieHeader: "cf_clearance=clearance-token",
      userAgent: "resolved-agent",
      status: 200,
    });

    await expect(
      fetcher.fetchHtml("https://rutracker.org/forum/viewforum.php?f=2387", {
        minDelayMs: 0,
        jitterMs: 0,
      }),
    ).rejects.toThrow("FlareSolverr could not get past the Cloudflare challenge");
  });

  it("stores FlareSolverr cookies and reuses them for direct requests", async () => {
    const flare = new FakeFlareClient();
    const store = new FakeSessionStore();
    const fetcher = new CrawlerFetcher(flare as any, store as any);

    flare.solve.mockResolvedValue({
      html: "<html><body>resolved page</body></html>",
      cookieHeader: "cf_clearance=clearance-token; bb_session=session-token",
      userAgent: "resolved-agent",
      status: 200,
    });

    await expect(
      fetcher.fetchHtml("https://rutracker.org/forum/viewtopic.php?t=123", {
        minDelayMs: 0,
        jitterMs: 0,
      }),
    ).resolves.toContain("resolved page");

    const directFetch = jest.fn().mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("<html><body>direct page</body></html>"),
    });
    jest.spyOn(global, "fetch").mockImplementation(directFetch as any);

    await expect(
      fetcher.fetchHtml("https://rutracker.org/forum/viewtopic.php?t=456", {
        minDelayMs: 0,
        jitterMs: 0,
      }),
    ).resolves.toContain("direct page");

    expect(flare.solve).toHaveBeenCalledTimes(1);
    expect(directFetch).toHaveBeenCalledWith(
      "https://rutracker.org/forum/viewtopic.php?t=456",
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: "cf_clearance=clearance-token; bb_session=session-token",
          "User-Agent": "resolved-agent",
        }),
      }),
    );
  });

  it("keeps proxy-enabled requests inside FlareSolverr instead of direct fetching", async () => {
    process.env.FLARESOLVERR_PROXY = "socks5://host.docker.internal:1080";
    const flare = new FakeFlareClient();
    const store = new FakeSessionStore();
    const fetcher = new CrawlerFetcher(flare as any, store as any);

    flare.solve.mockResolvedValue({
      html: "<html><body>proxied page</body></html>",
      cookieHeader: "cf_clearance=clearance-token",
      userAgent: "resolved-agent",
      status: 200,
    });

    const directFetch = jest.fn();
    jest.spyOn(global, "fetch").mockImplementation(directFetch as any);

    await fetcher.fetchHtml("https://rutracker.org/forum/viewtopic.php?t=123", {
      minDelayMs: 0,
      jitterMs: 0,
    });
    await fetcher.fetchHtml("https://rutracker.org/forum/viewtopic.php?t=456", {
      minDelayMs: 0,
      jitterMs: 0,
    });

    expect(directFetch).not.toHaveBeenCalled();
    expect(flare.solve).toHaveBeenCalledTimes(2);
    expect(flare.solve).toHaveBeenCalledWith(
      "https://rutracker.org/forum/viewtopic.php?t=456",
      undefined,
      { url: "socks5://host.docker.internal:1080" },
    );
  });
});
