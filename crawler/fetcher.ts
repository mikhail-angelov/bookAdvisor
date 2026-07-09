/**
 * HTTP fetcher with retry logic and windows-1251 encoding support
 */

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import * as iconv from 'iconv-lite';
import { FetchResult } from './types';

export interface FetchOptions {
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

interface FlareSolverrCookie {
  name: string;
  value: string;
}

interface FlareSolverrResponse {
  status?: string;
  message?: string;
  solution?: {
    cookies?: FlareSolverrCookie[];
    userAgent?: string;
  };
}

interface RutrackerSession {
  cookieHeader: string;
  userAgent?: string;
  resolvedAt: number;
}

const RUTRACKER_HOST = 'rutracker.org';
const SESSION_TTL_MS = 45 * 60 * 1000;
const FLARESOLVERR_MAX_TIMEOUT_MS = 60000;

let rutrackerSession: RutrackerSession | null = null;

function isRutrackerUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(RUTRACKER_HOST);
  } catch {
    return false;
  }
}

function getFlareSolverrUrl(): string | undefined {
  const url = process.env.FLARESOLVERR_URL?.trim();
  return url || undefined;
}

function hasFreshRutrackerSession(): boolean {
  return Boolean(
    rutrackerSession &&
      Date.now() - rutrackerSession.resolvedAt < SESSION_TTL_MS &&
      rutrackerSession.cookieHeader,
  );
}

function buildCookieHeader(cookies: FlareSolverrCookie[] | undefined): string {
  return (cookies ?? [])
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

async function resolveRutrackerSession(url: string, forceRefresh = false): Promise<RutrackerSession | null> {
  const solverUrl = getFlareSolverrUrl();
  if (!solverUrl || !isRutrackerUrl(url)) {
    return null;
  }

  if (!forceRefresh && hasFreshRutrackerSession()) {
    return rutrackerSession;
  }

  console.log(`Resolving Rutracker session via FlareSolverr for ${url}`);
  const response = await axios.post<FlareSolverrResponse>(
    solverUrl,
    {
      cmd: 'request.get',
      url,
      maxTimeout: FLARESOLVERR_MAX_TIMEOUT_MS,
    },
    {
      timeout: FLARESOLVERR_MAX_TIMEOUT_MS + 5000,
      validateStatus: (status) => status >= 200 && status < 500,
    },
  );

  if (response.status >= 400 || response.data.status !== 'ok') {
    throw new Error(
      `FlareSolverr failed with HTTP ${response.status}: ${response.data.message ?? 'unknown error'}`,
    );
  }

  const cookieHeader = buildCookieHeader(response.data.solution?.cookies);
  if (!cookieHeader) {
    throw new Error('FlareSolverr did not return cookies for Rutracker');
  }

  rutrackerSession = {
    cookieHeader,
    userAgent: response.data.solution?.userAgent,
    resolvedAt: Date.now(),
  };

  console.log('Resolved Rutracker session cookies via FlareSolverr');
  return rutrackerSession;
}

function looksLikeBlockedHtml(html: string): boolean {
  const normalized = html.slice(0, 10000).toLowerCase();
  return (
    normalized.includes('cf-browser-verification') ||
    normalized.includes('cf_chl_') ||
    normalized.includes('cloudflare') ||
    normalized.includes('just a moment') ||
    normalized.includes('ddos-guard') ||
    normalized.includes('attention required')
  );
}

function decodeHtmlResponse(response: AxiosResponse<Buffer>): {
  html: string;
  contentType: string;
  encoding: string;
} {
  const contentType = response.headers['content-type'] || '';
  const buffer = response.data;

  // Sniff charset from <meta charset="..."> or <meta http-equiv="Content-Type" content="...charset=...">
  // Use latin1 to read raw bytes without corruption
  const sniff = buffer.slice(0, 4096).toString('latin1');
  const metaCharsetMatch =
    sniff.match(/<meta[^>]+charset=["']?\s*([^"'\s;>]+)/i) ||
    sniff.match(/charset=["']?\s*([^"'\s;>]+)/i);
  const metaCharset = metaCharsetMatch?.[1]?.toLowerCase() ?? '';

  const encoding = iconv.encodingExists(metaCharset) ? metaCharset : 'utf-8';
  const html = iconv.decode(buffer, encoding);

  return { html, contentType, encoding };
}

async function fetchWithAxios(
  url: string,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<FetchResult> {
  const response = await axios.get<Buffer>(url, {
    headers,
    timeout: timeoutMs,
    responseType: 'arraybuffer',
    validateStatus: (status) => status >= 200 && status < 500,
  });

  const { html, contentType, encoding } = decodeHtmlResponse(response);

  if (response.status >= 400) {
    return {
      url,
      html: '',
      status: response.status,
      contentType,
      encoding,
      error: `HTTP ${response.status}`,
    };
  }

  if (isRutrackerUrl(url) && looksLikeBlockedHtml(html)) {
    return {
      url,
      html: '',
      status: response.status,
      contentType,
      encoding,
      error: 'Blocked/challenge HTML received instead of target page',
    };
  }

  return { url, html, status: response.status, contentType, encoding };
}

async function buildRequestHeaders(
  url: string,
  headers: Record<string, string>,
  forceSessionRefresh = false,
): Promise<Record<string, string>> {
  const mergedHeaders = { ...DEFAULT_HEADERS, ...headers };
  const session = await resolveRutrackerSession(url, forceSessionRefresh);

  if (!session) {
    return mergedHeaders;
  }

  return {
    ...mergedHeaders,
    'User-Agent': session.userAgent ?? mergedHeaders['User-Agent'],
    Cookie: session.cookieHeader,
  };
}

/**
 * Fetch a URL with retry logic and windows-1251 encoding detection.
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    retryAttempts = 3,
    retryDelayMs = 1000,
    timeoutMs = 30000,
    headers = {}
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const requestHeaders = await buildRequestHeaders(url, headers);
      const result = await fetchWithAxios(url, timeoutMs, requestHeaders);

      if (
        result.error === 'Blocked/challenge HTML received instead of target page' &&
        getFlareSolverrUrl() &&
        isRutrackerUrl(url)
      ) {
        console.warn(`Rutracker challenge detected for ${url}; refreshing FlareSolverr cookies`);
        const refreshedHeaders = await buildRequestHeaders(url, headers, true);
        return await fetchWithAxios(url, timeoutMs, refreshedHeaders);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error: any) {
      lastError = error;
      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  const errorMessage = lastError?.message ?? 'Unknown error';
  console.error(`All ${retryAttempts + 1} attempts failed for ${url}: ${errorMessage}`);
  return { url, html: '', status: 0, error: errorMessage };
}
