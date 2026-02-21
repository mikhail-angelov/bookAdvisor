/**
 * Service to process crawled HTML and populate the books table
 */

import { v4 as uuidv4 } from "uuid";
import * as iconv from "iconv-lite";
import { RutrackerParser, RutrackerDetailsParser } from "./parsers";
import {
  getCompletedCrawls,
  batchUpsertBooks,
  updateBooks,
  getCompletedCrawlsCount,
} from "./repository";
import { CrawlType } from "./types";
import { NewBook } from "../db/schema";
import type { Crawl } from "../db/schema";

/**
 * Ensure HTML string is properly decoded.
 * If the crawl was stored with windows-1251 codePage but the text looks like
 * it was mis-decoded (contains replacement characters), attempt re-decoding
 * by treating the string as latin1 bytes and re-decoding with iconv.
 */
function getDecodedHtml(crawl: Crawl): string {
  const html = crawl.htmlBody ?? "";
  if (!html) return html;

  // If codePage is windows-1251 and the HTML contains replacement chars (U+FFFD or ?)
  // it was likely stored with wrong encoding — re-decode from latin1 bytes
  if (crawl.codePage === "windows-1251" && html.includes("\uFFFD")) {
    try {
      const bytes = Buffer.from(html, "latin1");
      return iconv.decode(bytes, "windows-1251");
    } catch {
      return html;
    }
  }

  return html;
}

const BATCH_SIZE = 300;

/**
 * Process completed FORUM_PAGE (torrents-page) crawls and update books
 * Processes all completed crawls in batches
 */
export async function processForumCrawls(
  forceReload: boolean = false,
  batchSize: number = BATCH_SIZE,
): Promise<number> {
  console.log(
    `Starting forum page processing (forceReload: ${forceReload}, batchSize: ${batchSize})...`,
  );

  const forumParser = new RutrackerParser();

  let totalProcessed = 0;
  let hasMore = true;
  const total = await getCompletedCrawlsCount({
    type: CrawlType.FORUM_PAGE,
    excludeProcessed: !forceReload,
  });

  while (hasMore) {
    const forumCrawls = await getCompletedCrawls({
      type: CrawlType.FORUM_PAGE,
      excludeProcessed: !forceReload,
      limit: batchSize,
      offset: totalProcessed,
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
): Promise<number> {
  console.log(
    `Starting detail page processing (forceReload: ${forceReload}, batchSize: ${batchSize})...`,
  );

  const detailParser = new RutrackerDetailsParser();

  let totalProcessed = 0;
  let hasMore = true;
  const total = await getCompletedCrawlsCount({
    type: CrawlType.TORRENT_DETAILS,
    excludeProcessed: !forceReload,
  });

  console.log(`Processing: ${total} detail pages.`);
  while (hasMore) {
    const detailCrawls = await getCompletedCrawls({
      type: CrawlType.TORRENT_DETAILS,
      excludeProcessed: !forceReload,
      limit: batchSize,
      offset: totalProcessed,
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

      const details = detailParser.parse(crawl.htmlBody, topicId);

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
): Promise<void> {
  console.log(
    `Starting crawl processing (forceReload: ${forceReload}, batchSize: ${batchSize})...`,
  );

  const forumCount = 0; //await processForumCrawls(forceReload, batchSize);
  const detailCount = await processDetailCrawls(forceReload, batchSize);

  console.log(
    `\nProcessing complete: ${forumCount} forum books and ${detailCount} detail books updated.`,
  );
}
