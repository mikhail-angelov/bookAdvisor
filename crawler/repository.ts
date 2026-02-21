/**
 * Database repository for crawl operations
 */

import { v4 as uuidv4 } from 'uuid';
import chunk from 'lodash/chunk';
import { eq, and, inArray, sql, count } from 'drizzle-orm';
import { getCrawlDbAsync, getAppDbAsync } from '../db/index';
import { crawl, crawlHistory, book } from '../db/index';
import type { Crawl, NewCrawl, NewCrawlHistory } from '../db/schema-crawl';
import type { NewBook } from '../db/schema-app';
import { CrawlStatus, CrawlType } from './types';

const CHUNK_SIZE = 500;

/**
 * Initialize crawl records for forum pages.
 */
export async function initializeCrawlRecords(
  forumId: number,
  pages: number,
  type: CrawlType = CrawlType.FORUM_PAGE
): Promise<string[]> {
  const db = await getCrawlDbAsync();
  const now = new Date().toISOString();

  const records: NewCrawl[] = Array.from({ length: pages }, (_, i): NewCrawl => {
    const start = i * 50;
    const url = `https://rutracker.org/forum/viewforum.php?f=${forumId}${start > 0 ? `&start=${start}` : ''}`;
    return { id: uuidv4(), url, status: CrawlStatus.PENDING, type, createdAt: now };
  });

  if (records.length === 0) return [];

  // For forum pages: upsert — reset existing records back to pending so they get re-crawled
  const urls = records.map(r => r.url);
  const existing = await db
    .select({ id: crawl.id, url: crawl.url })
    .from(crawl)
    .where(inArray(crawl.url, urls));
  const existingByUrl = new Map(existing.map(r => [r.url, r.id]));

  const toInsert = records.filter(r => !existingByUrl.has(r.url));
  const toReset = records.filter(r => existingByUrl.has(r.url));

  if (toInsert.length > 0) {
    await db.insert(crawl).values(toInsert);
  }
  for (const r of toReset) {
    await db.update(crawl)
      .set({ status: CrawlStatus.PENDING, htmlBody: null, codePage: null })
      .where(eq(crawl.url, r.url));
  }

  console.log(`Initialized ${records.length} crawl records for forum ID ${forumId} (${toInsert.length} new, ${toReset.length} reset)`);

  // Return IDs: inserted ones use new IDs, reset ones use existing IDs
  return records.map(r => existingByUrl.get(r.url) ?? r.id);
}

/**
 * Create a new crawl history record.
 */
export async function createCrawlHistory(forumId: number): Promise<string> {
  const db = await getCrawlDbAsync();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.insert(crawlHistory).values({
    id,
    forumId,
    pagesCrawled: 0,
    torrentsFound: 0,
    startedAt: now,
    status: 'running',
    createdAt: now,
  });

  return id;
}

/**
 * Update crawl history with progress or completion data.
 */
export async function updateCrawlHistory(
  historyId: string,
  updates: Partial<NewCrawlHistory>
): Promise<void> {
  const db = await getCrawlDbAsync();
  await db.update(crawlHistory).set(updates).where(eq(crawlHistory.id, historyId));
}

/**
 * Get pending crawl records, optionally filtered by type.
 */
export async function getPendingCrawlRecords(
  type?: CrawlType,
  limit?: number
): Promise<Crawl[]> {
  const db = await getCrawlDbAsync();

  const conditions = [eq(crawl.status, CrawlStatus.PENDING)];
  if (type) conditions.push(eq(crawl.type, type));

  const query = db.select().from(crawl).where(and(...conditions));
  return limit ? query.limit(limit) : query;
}

/**
 * Update a crawl record's fields.
 */
export async function updateCrawlRecord(
  id: string,
  updates: Partial<NewCrawl>
): Promise<void> {
  const db = await getCrawlDbAsync();
  await db.update(crawl).set(updates).where(eq(crawl.id, id));
}

/**
 * Create crawl records for torrent detail pages, skipping already-known URLs.
 * Uses a single bulk SELECT to avoid N+1 queries.
 */
export async function createFreshTorrentDetailCrawlRecords(
  torrentUrls: string[]
): Promise<string[]> {
  if (torrentUrls.length === 0) return [];

  const db = await getCrawlDbAsync();
  const now = new Date().toISOString();
  const allNewIds: string[] = [];

  for (const urlsChunk of chunk(torrentUrls, CHUNK_SIZE)) {
    // Find which URLs already exist
    const existing = await db
      .select({ url: crawl.url })
      .from(crawl)
      .where(inArray(crawl.url, urlsChunk));

    const existingUrls = new Set(existing.map(r => r.url));

    const newRecords: NewCrawl[] = urlsChunk
      .filter(url => !existingUrls.has(url))
      .map(url => ({
        id: uuidv4(),
        url,
        status: CrawlStatus.PENDING,
        type: CrawlType.TORRENT_DETAILS,
        createdAt: now,
      }));

    if (newRecords.length > 0) {
      await db.insert(crawl).values(newRecords);
      allNewIds.push(...newRecords.map(r => r.id));
    }
  }

  if (allNewIds.length > 0) {
    console.log(`Created ${allNewIds.length} detail crawl records`);
  }

  return allNewIds;
}

/**
 * Get crawl statistics grouped by status.
 */
export async function getCrawlStatistics(): Promise<{
  total: number;
  pending: number;
  completed: number;
  error: number;
}> {
  const db = await getCrawlDbAsync();
  const results = await db
    .select({ status: crawl.status, count: sql<number>`count(*)` })
    .from(crawl)
    .groupBy(crawl.status);

  const stats = { total: 0, pending: 0, completed: 0, error: 0 };
  for (const r of results) {
    const count = Number(r.count);
    stats.total += count;
    if (r.status === CrawlStatus.PENDING) stats.pending = count;
    else if (r.status === CrawlStatus.COMPLETED) stats.completed = count;
    else if (r.status === CrawlStatus.ERROR) stats.error = count;
  }

  return stats;
}

/**
 * Mark a crawl record as completed with its HTML content.
 */
export async function markCrawlRecordCompleted(
  id: string,
  html: string,
  codePage: string = 'windows-1251'
): Promise<void> {
  await updateCrawlRecord(id, { status: CrawlStatus.COMPLETED, htmlBody: html, codePage });
}

/**
 * Mark a crawl record as failed with an error message.
 */
export async function markCrawlRecordFailed(id: string, error: string): Promise<void> {
  await updateCrawlRecord(id, { status: CrawlStatus.ERROR, htmlBody: error });
}

/**
 * Get all completed crawls, optionally filtered by type and excluding already-processed ones.
 * This function needs both databases - crawlDb for crawl records and prodDb for book records.
 */
export async function getCompletedCrawls(
  options: {
    type?: CrawlType | string;
    excludeProcessed?: boolean;
    limit?: number
    offset?: number
  } = {},
): Promise<Crawl[]> {
  const crawlDb = await getCrawlDbAsync();
  const prodDb = await getAppDbAsync();
  
  const conditions = [eq(crawl.status, CrawlStatus.COMPLETED)];
  if (options.type) conditions.push(eq(crawl.type, options.type));

  if (options.excludeProcessed) {
    const processedIds = prodDb
      .select({ id: book.crawlId })
      .from(book)
      .where(sql`${book.crawlId} IS NOT NULL`);

    let query = crawlDb
      .select()
      .from(crawl)
      .where(and(...conditions, sql`${crawl.id} NOT IN (${processedIds})`));
    
    return (options.limit && (options.offset || options.offset ===0)) ? query.limit(options.limit).offset(options.offset) : query;
  }

  let query = crawlDb.select().from(crawl).where(and(...conditions));
  return (options.limit && (options.offset || options.offset ===0)) ? query.limit(options.limit).offset(options.offset) : query;
}
export async function getCompletedCrawlsCount(
  options: {
    type?: CrawlType | string;
    excludeProcessed?: boolean;
  } = {},
): Promise<number> {
  const crawlDb = await getCrawlDbAsync();
  const prodDb = await getAppDbAsync();
  
  const conditions = [eq(crawl.status, CrawlStatus.COMPLETED)];
  if (options.type) conditions.push(eq(crawl.type, options.type));

  if (options.excludeProcessed) {
    const processedIds = prodDb
      .select({ id: book.crawlId })
      .from(book)
      .where(sql`${book.crawlId} IS NOT NULL`);

    const result = await crawlDb
      .select({ count: count() })
      .from(crawl)
      .where(and(...conditions, sql`${crawl.id} NOT IN (${processedIds})`));
    
    return result[0].count;
  }

  const result = await crawlDb.select({ count: count() }).from(crawl).where(and(...conditions));
  return result[0].count;
}

/**
 * Batch insert books, processing in chunks to avoid SQL stack overflow with large datasets.
 * Skips books whose URL already exists in the database.
 */
export async function batchUpsertBooks(books: NewBook[]): Promise<void> {
  if (books.length === 0) return;

  const prodDb = await getAppDbAsync();
  let totalInserted = 0;

  for (const booksChunk of chunk(books, CHUNK_SIZE)) {
    const urls = booksChunk.map(b => b.url ?? '').filter(Boolean);

    const existing = urls.length > 0
      ? await prodDb.select({ url: book.url }).from(book).where(inArray(book.url, urls))
      : [];

    const existingUrls = new Set(existing.map(r => r.url));
    const toInsert = booksChunk.filter(b => b.url && !existingUrls.has(b.url));

    if (toInsert.length > 0) {
      await prodDb.insert(book).values(toInsert);
      totalInserted += toInsert.length;
    }
  }

  console.log(`Successfully processed ${books.length} books (${totalInserted} inserted)`);
}

/**
 * Update existing books by URL, processing in chunks to avoid SQL stack overflow with large datasets.
 * Only updates books whose URL already exists in the database.
 */
export async function updateBooks(books: Partial<NewBook>[]): Promise<void> {
  if (books.length === 0) return;

  const prodDb = await getAppDbAsync();
  let totalUpdated = 0;

  const urls = books.map(b => b.url ?? '').filter(Boolean);

  const existing = urls.length > 0
    ? await prodDb.select({ url: book.url }).from(book).where(inArray(book.url, urls))
    : [];

  const existingUrls = new Set(existing.map(r => r.url));
  const toUpdate = books.filter(b => b.url && existingUrls.has(b.url));

  for (const { url, ...data } of toUpdate) {
    if (url) {
      await prodDb.update(book).set(data).where(eq(book.url, url));
      totalUpdated++;
    }
  }
}
