/**
 * HTTP fetcher with retry logic and windows-1251 encoding support.
 *
 * For rutracker.org URLs, uses a self-hosted FlareSolverr instance to
 * bypass Cloudflare. For other domains, falls back to plain axios.
 */

import axios from "axios";
import * as iconv from "iconv-lite";
import { FlareClient } from "./flare-client";
import { SessionStore, type Session } from "./session-store";
import { type FetchResult } from "./types";

export interface FetchOptions {
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

// ─── FlareSolverr integration ────────────────────────────────────────────────

const CHALLENGE_MARKERS = [
  "Just a moment",
  "challenges.cloudflare.com",
  "cf-browser-verification",
];

function isChallengePage(html: string, status: number): boolean {
  if (status === 403 || status === 503) return true;
  return CHALLENGE_MARKERS.some((marker) => html.includes(marker));
}

function domainOf(url: string): string {
  return new URL(url).hostname;
}

function jitter(baseMs: number, spreadMs: number): Promise<void> {
  const delay = baseMs + Math.random() * spreadMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export interface FlareFetchOptions {
  /** Minimum delay before this request, in ms. Default 1500. */
  minDelayMs?: number;
  /** Extra random delay added on top of minDelayMs. Default 3000. */
  jitterMs?: number;
  /** Force re-solving the Cloudflare challenge even if a cached session exists. */
  forceResolve?: boolean;
}

/**
 * Fetcher that transparently bypasses Cloudflare using a self-hosted
 * FlareSolverr instance, with cookie session caching so most requests
 * skip the expensive headless-browser solve entirely.
 */
export class CrawlerFetcher {
  private flare = new FlareClient();
  private store = new SessionStore();

  /**
   * Fetch a page as plain text/HTML, transparently handling Cloudflare.
   * Reuses a cached cf_clearance cookie + matching User-Agent when possible;
   * only calls FlareSolverr when the cached session is missing or stale.
   */
  async fetchHtml(
    url: string,
    options: FlareFetchOptions = {},
  ): Promise<string> {
    const { minDelayMs = 1500, jitterMs = 3000, forceResolve = false } =
      options;
    const domain = domainOf(url);

    await jitter(minDelayMs, jitterMs);

    let session = forceResolve ? null : await this.store.get(domain);

    if (session) {
      const direct = await this.tryDirectFetch(url, session);
      if (direct !== null) return direct;
      await this.store.invalidate(domain);
      session = null;
    }

    // No usable session: solve via FlareSolverr and cache the result.
    const solved = await this.flare.solve(url);
    if (isChallengePage(solved.html, solved.status)) {
      throw new Error(
        `FlareSolverr could not get past the Cloudflare challenge for ${url} (status ${solved.status}).`,
      );
    }

    const newSession: Session = {
      cookieHeader: solved.cookieHeader,
      userAgent: solved.userAgent,
      createdAt: Date.now(),
    };
    await this.store.set(domain, newSession);

    return solved.html;
  }

  /** Returns the HTML if the cached-cookie direct request succeeds, or null on challenge. */
  private async tryDirectFetch(
    url: string,
    session: Session,
  ): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": session.userAgent,
          Cookie: session.cookieHeader,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
      });
      const html = await res.text();
      if (isChallengePage(html, res.status)) return null;
      return html;
    } catch {
      return null;
    }
  }
}

/** Convenience singleton so callers don't need to manage the class. */
const defaultFetcher = new CrawlerFetcher();
export function fetchHtml(
  url: string,
  options?: FlareFetchOptions,
): Promise<string> {
  return defaultFetcher.fetchHtml(url, options);
}

// ─── Legacy axios-based fetcher (non-rutracker URLs) ─────────────────────────

/**
 * Fetch a URL with retry logic and windows-1251 encoding detection.
 * Uses the FlareSolverr-backed CrawlerFetcher for rutracker.org URLs
 * and falls back to axios for everything else.
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  // rutracker.org is behind Cloudflare — use the FlareSolverr path.
  if (url.includes("rutracker.org")) {
    return fetchWithFlareSolverr(url, options);
  }

  // Non-rutracker URLs: plain axios with retry and encoding detection.
  return fetchWithAxios(url, options);
}

async function fetchWithFlareSolverr(
  url: string,
  options: FetchOptions,
): Promise<FetchResult> {
  const { retryAttempts = 3, retryDelayMs = 1000 } = options;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const html = await defaultFetcher.fetchHtml(url, {
        minDelayMs: attempt > 0 ? 1000 : 1500,
        jitterMs: 3000,
      });

      // FlareSolverr returns decoded text. Re-encode to bytes and decode
      // with charset detection so parsers get consistent UTF-8 output.
      const buffer = Buffer.from(html, "latin1");
      const sniff = html.slice(0, 4096).toLowerCase();
      const metaCharsetMatch =
        sniff.match(/<meta[^>]+charset=["']?\s*([^"';\s>]+)/i) ??
        sniff.match(/charset=["']?\s*([^"';\s>]+)/i);
      const metaCharset = metaCharsetMatch?.[1]?.toLowerCase() ?? "";
      const encoding = iconv.encodingExists(metaCharset)
        ? metaCharset
        : "windows-1251";
      const decoded = iconv.decode(buffer, encoding);

      return {
        url,
        html: decoded,
        status: 200,
        contentType: `text/html; charset=${encoding}`,
        encoding,
      };
    } catch (err: any) {
      if (attempt < retryAttempts) {
        console.warn(
          `FlareSolverr attempt ${attempt + 1} failed for ${url}: ${err.message}. Retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } else {
        console.error(
          `All ${retryAttempts + 1} FlareSolverr attempts failed for ${url}: ${err.message}`,
        );
        return { url, html: "", status: 0, error: err.message };
      }
    }
  }

  return { url, html: "", status: 0, error: "Unexpected error" };
}

async function fetchWithAxios(
  url: string,
  options: FetchOptions,
): Promise<FetchResult> {
  const {
    retryAttempts = 3,
    retryDelayMs = 1000,
    timeoutMs = 30000,
    headers = {},
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        timeout: timeoutMs,
        responseType: "arraybuffer",
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType = response.headers["content-type"] || "";
      const buffer = response.data as Buffer;

      // Sniff charset from <meta charset="..."> or
      // <meta http-equiv="Content-Type" content="...charset=...">
      const sniff = buffer.slice(0, 4096).toString("latin1");
      const metaCharsetMatch =
        sniff.match(/<meta[^>]+charset=["']?\s*([^"'\s;>]+)/i) ??
        sniff.match(/charset=["']?\s*([^"'\s;>]+)/i);
      const metaCharset = metaCharsetMatch?.[1]?.toLowerCase() ?? "";

      const encoding = iconv.encodingExists(metaCharset)
        ? metaCharset
        : "utf-8";

      const html = iconv.decode(buffer, encoding);

      return { url, html, status: response.status, contentType, encoding };
    } catch (error: any) {
      lastError = error;
      if (attempt < retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  const errorMessage = lastError?.message ?? "Unknown error";
  console.error(
    `All ${retryAttempts + 1} attempts failed for ${url}: ${errorMessage}`,
  );
  return { url, html: "", status: 0, error: errorMessage };
}
