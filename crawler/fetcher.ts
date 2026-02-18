/**
 * HTTP fetcher with retry logic and windows-1251 encoding support
 */

import axios, { AxiosResponse } from 'axios';
import * as iconv from 'iconv-lite';
import { FetchResult } from './types';

export interface FetchOptions {
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch URL with retry logic and windows-1251 encoding detection
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

  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    ...headers
  };

  let lastError: any = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      console.log(`Fetching ${url} (attempt ${attempt + 1}/${retryAttempts + 1})`);

      const response = await axios.get(url, {
        headers: defaultHeaders,
        timeout: timeoutMs,
        responseType: 'arraybuffer', // Get raw bytes for iconv decoding
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Determine encoding from Content-Type header
      const contentType = response.headers['content-type'] || '';
      let encoding = 'utf-8';
      if (contentType.includes('charset=win1251') || contentType.includes('charset=windows-1251')) {
        encoding = 'windows-1251';
      } else if (contentType.includes('charset=cp1251')) {
        encoding = 'cp1251';
      }

      // Decode the response
      let html: string;
      if (encoding === 'utf-8') {
        html = response.data.toString('utf-8');
      } else {
        html = iconv.decode(response.data, encoding);
      }

      console.log(`Successfully fetched ${url} (${html.length} bytes, encoding: ${encoding})`);

      return {
        url,
        html,
        status: response.status,
        contentType,
        encoding
      };

    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1}/${retryAttempts + 1} failed for ${url}:`, error.message);

      // Don't wait after the last attempt
      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // All retries failed
  const errorMessage = lastError?.message || 'Unknown error';
  console.error(`All ${retryAttempts + 1} attempts failed for ${url}:`, errorMessage);

  return {
    url,
    html: '',
    status: 0,
    error: errorMessage
  };
}

/**
 * Batch fetch multiple URLs with concurrency control
 */
export async function fetchUrls(
  urls: string[],
  options: FetchOptions = {},
  concurrency: number = 5
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  let currentIndex = 0;

  // Process URLs in batches
  while (currentIndex < urls.length) {
    const batch = urls.slice(currentIndex, currentIndex + concurrency);
    const batchPromises = batch.map(url => fetchUrl(url, options));

    const batchResults = await Promise.allSettled(batchPromises);

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const url = batch[i];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          url,
          html: '',
          status: 0,
          error: result.reason?.message || 'Unknown error'
        });
      }
    }

    currentIndex += concurrency;

    // Small delay between batches to be polite
    if (currentIndex < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}