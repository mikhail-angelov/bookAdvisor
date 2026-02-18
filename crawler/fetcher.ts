/**
 * HTTP fetcher with retry logic and windows-1251 encoding support
 */

import axios from 'axios';
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
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        timeout: timeoutMs,
        responseType: 'arraybuffer',
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType = response.headers['content-type'] || '';
      const buffer = response.data as Buffer;

      // Sniff charset from <meta charset="..."> or <meta http-equiv="Content-Type" content="...charset=...">
      // Use latin1 to read raw bytes without corruption
      const sniff = buffer.slice(0, 4096).toString('latin1');
      const metaCharsetMatch =
        sniff.match(/<meta[^>]+charset=["']?\s*([^"'\s;>]+)/i) ||
        sniff.match(/charset=["']?\s*([^"'\s;>]+)/i);
      const metaCharset = metaCharsetMatch?.[1]?.toLowerCase() ?? '';

      const encoding = iconv.encodingExists(metaCharset) ? metaCharset : 'utf-8';

      const html = iconv.decode(buffer, encoding);

      return { url, html, status: response.status, contentType, encoding };
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
