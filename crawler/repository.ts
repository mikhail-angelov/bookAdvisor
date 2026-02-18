/**
 * Database repository for crawl operations
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getDbAsync } from '../db/index';
import { crawl, crawlHistory, book } from '../db/index';
import type { Crawl, NewCrawl, NewCrawlHistory, NewBook } from '../db/schema';
import { CrawlStatus, CrawlType } from './types';

/**
 * Initialize crawl records for forum pages.
 */
export async function initializeCrawlRecords(
  forumId: number,
  pages: number,
  type: CrawlType = CrawlType.FORUM_PAGE
): Promise<string[]> {
  const db = await getDbAsync();
  const now = new Date().toISOString();

  const records: NewCrawl[] = Array.from({ length: pages }, (_, i) => {
    const start = i * 50;
    const url = `https://rutracker.org/forum/viewforum.php?f=${forumId}${start > 0 ? `&start=${start}` : ''}`;
    return { id: uuidv4(), url, status: CrawlStatus.PENDING, type, createdAt: now };
  });

  if (records.length > 0) {
    await db.insert(crawl).values(records);
    console.log(`Created ${records.length} crawl records for forum ID ${forumId}`);
  }

  return records.map(r => r.id);
}

/**
 * Create a new crawl history record.
 */
export async function createCrawlHistory(forumId: number): Promise<string> {
  const db = await getDbAsync();
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
  const db = await getDbAsync();
  await db.update(crawlHistory).set(updates).where(eq(crawlHistory.id, historyId));
}

/**
 * Get pending crawl records, optionally filtered by type.
 */
export async function getPendingCrawlRecords(
  type?: CrawlType,
  limit?: number
): Promise<Crawl[]> {
  const db = await getDbAsync();

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
  const db = await getDbAsync();
  await db.update(crawl).set(updates).where(eq(crawl.id, id));
}

/**
 * Create crawl records for torrent detail pages, skipping already-known URLs.
 * Uses a single bulk SELECT to avoid N+1 queries.
 */
export async function createTorrentDetailCrawlRecords(
  torrentUrls: string[]
): Promise<string[]> {
  if (torrentUrls.length === 0) return [];

  const db = await getDbAsync();
  const now = new Date().toISOString();

  // Fetch all existing URLs in one query
  const existing = await db
    .select({ url: crawl.url })
    .from(crawl)
    .where(inArray(crawl.url, torrentUrls));

  const existingUrls = new Set(existing.map(r => r.url));

  const newRecords: NewCrawl[] = torrentUrls
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
    console.log(`Created ${newRecords.length} detail crawl records`);
  }

  return newRecords.map(r => r.id);
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
  const db = await getDbAsync();
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
 */
export async function getCompletedCrawls(options: {
  type?: CrawlType | string;
  excludeProcessed?: boolean;
} = {}): Promise<Crawl[]> {
  const db = await getDbAsync();
  const conditions = [eq(crawl.status, CrawlStatus.COMPLETED)];
  if (options.type) conditions.push(eq(crawl.type, options.type));

  if (options.excludeProcessed) {
    const processedIds = db
      .select({ id: book.crawlId })
      .from(book)
      .where(sql`${book.crawlId} IS NOT NULL`);

    return db
      .select()
      .from(crawl)
      .where(and(...conditions, sql`${crawl.id} NOT IN (${processedIds})`));
  }

  return db.select().from(crawl).where(and(...conditions));
}

/**
 * Batch insert or update books.
 * Uses a single SELECT to find existing URLs, then splits into inserts and updates.
 */
export async function batchUpsertBooks(books: NewBook[]): Promise<void> {
  if (books.length === 0) return;

  const db = await getDbAsync();

  const urls = books.map(b => b.url ?? '').filter(Boolean);

  // Single query to find all existing books by URL
  const existing = urls.length > 0
    ? await db.select({ id: book.id, url: book.url }).from(book).where(inArray(book.url, urls))
    : [];

  const existingByUrl = new Map(existing.map(r => [r.url, r.id]));

  const toInsert: NewBook[] = [];
  const toUpdate: Array<{ id: string; data: NewBook }> = [];

  for (const b of books) {
    const existingId = b.url ? existingByUrl.get(b.url) : undefined;
    if (existingId) {
      toUpdate.push({ id: existingId, data: b });
    } else {
      toInsert.push(b);
    }
  }

  await db.transaction(async (tx) => {
    if (toInsert.length > 0) {
      await tx.insert(book).values(toInsert);
    }
    for (const { id, data } of toUpdate) {
      await tx.update(book).set(data).where(eq(book.id, id));
    }
  });

  console.log(`Successfully processed ${books.length} books (${toInsert.length} inserted, ${toUpdate.length} updated)`);
}
