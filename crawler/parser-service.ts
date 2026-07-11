/**
 * Service to process crawled HTML and populate the books table
 */

import * as iconv from "iconv-lite";
import { RutrackerParser, RutrackerDetailsParser } from "./parsers";
import {
  getCompletedCrawls,
  updateBooks,
  getCompletedCrawlsCount,
} from "./repository";
import { CrawlType } from "./types";
import { NewBook } from "../db/schema";
import type { Crawl } from "../db/schema";

function sniffHtmlEncoding(html: string, fallbackEncoding = "windows-1251"): string {
  const sniff = html.slice(0, 4096);
  const metaCharsetMatch =
    sniff.match(/<meta[^>]+charset=["']?\s*([^"'\s;>]+)/i) ??
    sniff.match(/charset=["']?\s*([^"'\s;>]+)/i);
  const metaCharset = metaCharsetMatch?.[1]?.toLowerCase() ?? "";

  return iconv.encodingExists(metaCharset) ? metaCharset : fallbackEncoding;
}

function isAlreadyDecoded(html: string): boolean {
  return /[\u0400-\u04FF]/.test(html);
}

function looksLikeRawBytes(html: string): boolean {
  return /[\u0080-\u00FF]/.test(html);
}

export function decodeStoredHtml(
  html: string,
  codePage?: string | null,
  fallbackEncoding = "windows-1251",
): string {
  if (!html) return html;
  if (isAlreadyDecoded(html)) return html;

  const shouldDecode =
    codePage === "raw-latin1" ||
    codePage === "crawler-raw" ||
    codePage === "windows-1251" ||
    html.includes("\uFFFD") ||
    looksLikeRawBytes(html);

  if (!shouldDecode) return html;

  try {
    const encoding = sniffHtmlEncoding(html, fallbackEncoding);
    return iconv.decode(Buffer.from(html, "latin1"), encoding);
  } catch {
    return html;
  }
}

function getDecodedHtml(crawl: Crawl): string {
  return decodeStoredHtml(crawl.htmlBody ?? "", crawl.codePage);
}

const BATCH_SIZE = 300;

/**
 * Process completed FORUM_PAGE (torrents-page) crawls and update books
 * Processes all completed crawls in batches
 */
export async function processForumCrawls(
  forceReload: boolean = false,
  batchSize: number = BATCH_SIZE,
  createdAfter?: string,
): Promise<number> {
  console.log(
    `Starting forum page processing (forceReload: ${forceReload}, batchSize: ${batchSize})...`,
  );

  const forumParser = new RutrackerParser();

  let totalProcessed = 0;
  let crawlOffset = 0;
  let hasMore = true;
  const total = await getCompletedCrawlsCount({
    type: CrawlType.FORUM_PAGE,
    createdAfter,
    excludeProcessed: !forceReload,
  });

  while (hasMore) {
    const forumCrawls = await getCompletedCrawls({
      type: CrawlType.FORUM_PAGE,
      createdAfter,
      excludeProcessed: !forceReload,
      limit: batchSize,
      offset: crawlOffset,
    });

    console.log(`Processing batch: ${forumCrawls.length} forum pages.`);

    if (forumCrawls.length === 0) {
      hasMore = false;
      break;
    }

    // Parse forum pages (torrents-page) and update status
    const updateBooksMap = new Map<string, Partial<NewBook>>();

    for (const crawl of forumCrawls) {
      if (!crawl.htmlBody) continue;

      const forumIdMatch = crawl.url.match(/f=(\d+)/);
      const forumId = forumIdMatch ? parseInt(forumIdMatch[1], 10) : 0;

      const parsedBooks = forumParser.parse(getDecodedHtml(crawl), forumId);

      for (const b of parsedBooks) {
        if (!b.url) continue;
        updateBooksMap.set(b.url, b as Partial<NewBook>);
      }
    }

    const booksToUpdate = Array.from(updateBooksMap.values());

    if (booksToUpdate.length > 0) {
      await updateBooks(booksToUpdate);
      totalProcessed += booksToUpdate.length;
      console.log(
        `Processed ${totalProcessed} books of ${total} from forum pages.`,
      );
    }

    // If we got fewer results than batchSize, we're done
    if (forumCrawls.length < batchSize) {
      hasMore = false;
    }

    crawlOffset += forumCrawls.length;
  }

  console.log(
    `Forum page processing complete: ${totalProcessed} books updated.`,
  );
  return totalProcessed;
}

/**
 * Process completed TORRENT_DETAILS (torrent-details) crawls and update books
 * Processes all completed crawls in batches
 */
export async function processDetailCrawls(
  forceReload: boolean = false,
  batchSize: number = BATCH_SIZE,
  createdAfter?: string,
): Promise<number> {
  console.log(
    `Starting detail page processing (forceReload: ${forceReload}, batchSize: ${batchSize})...`,
  );

  const detailParser = new RutrackerDetailsParser();

  let totalProcessed = 0;
  let crawlOffset = 0;
  let hasMore = true;
  const total = await getCompletedCrawlsCount({
    type: CrawlType.TORRENT_DETAILS,
    createdAfter,
    excludeProcessed: !forceReload,
  });

  console.log(`Processing: ${total} detail pages.`);
  while (hasMore) {
    const detailCrawls = await getCompletedCrawls({
      type: CrawlType.TORRENT_DETAILS,
      createdAfter,
      excludeProcessed: !forceReload,
      limit: batchSize,
      offset: crawlOffset,
    });

    if (detailCrawls.length === 0) {
      hasMore = false;
      break;
    }

    // Parse detail pages (torrent-details) - update existing books
    const detailUpdates: Partial<NewBook>[] = [];

    for (const crawl of detailCrawls) {
      if (!crawl.htmlBody) continue;

      const topicIdMatch = crawl.url.match(/t=(\d+)/);
      const topicId = topicIdMatch ? topicIdMatch[1] : undefined;

      const details = detailParser.parse(getDecodedHtml(crawl), topicId);

      // Add URL to the details for updating
      detailUpdates.push({
        url: crawl.url,
        ...details,
      });
    }

    // Update books with details
    if (detailUpdates.length > 0) {
      await updateBooks(detailUpdates);
      totalProcessed += detailUpdates.length;
      console.log(
        `Processed ${totalProcessed} books of ${total} with details.`,
      );
    }

    // If we got fewer results than batchSize, we're done
    if (detailCrawls.length < batchSize) {
      hasMore = false;
    }

    crawlOffset += detailCrawls.length;
  }

  console.log(
    `Detail page processing complete: ${totalProcessed}/${total} books updated.`,
  );
  return totalProcessed;
}

/**
 * Process all completed crawls and populate books table
 * Processes both forum pages and detail pages
 */
export async function processCrawls(
  forceReload: boolean = false,
  batchSize: number = BATCH_SIZE,
  createdAfter?: string,
): Promise<void> {
  console.log(
    `Starting crawl processing (forceReload: ${forceReload}, batchSize: ${batchSize})...`,
  );

  const forumCount = await processForumCrawls(forceReload, batchSize, createdAfter);
  const detailCount = await processDetailCrawls(forceReload, batchSize, createdAfter);

  console.log(
    `\nProcessing complete: ${forumCount} forum books and ${detailCount} detail books updated.`,
  );
}
