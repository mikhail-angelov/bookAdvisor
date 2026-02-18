/**
 * Database repository for crawl operations
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import { getDbAsync } from '../db/index';
import { crawl, crawlHistory } from '../db/index';
import type { Crawl, NewCrawl, NewCrawlHistory } from '../db/schema';
import { CrawlStatus, CrawlType } from './types';

/**
 * Initialize crawl records for forum pages
 */
export async function initializeCrawlRecords(
  forumId: number,
  pages: number,
  type: CrawlType = CrawlType.FORUM_PAGE
): Promise<string[]> {
  const db = await getDbAsync();
  const records: NewCrawl[] = [];
  const now = new Date().toISOString();
  
  for (let i = 0; i < pages; i++) {
    const start = i * 50;
    const url = `https://rutracker.org/forum/viewforum.php?f=${forumId}${start > 0 ? `&start=${start}` : ''}`;
    
    records.push({
      id: uuidv4(),
      url,
      status: CrawlStatus.PENDING,
      type,
      createdAt: now
    });
  }
  
  if (records.length > 0) {
    await db.insert(crawl).values(records);
    console.log(`Created ${records.length} crawl records for forum ID ${forumId}`);
  }
  
  return records.map(r => r.id);
}

/**
 * Create a new crawl history record
 */
export async function createCrawlHistory(
  forumId: number
): Promise<string> {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  const id = uuidv4();
  
  const historyRecord: NewCrawlHistory = {
    id,
    forumId,
    pagesCrawled: 0,
    torrentsFound: 0,
    startedAt: now,
    status: 'running',
    createdAt: now
  };
  
  await db.insert(crawlHistory).values(historyRecord);
  
  return id;
}

/**
 * Update crawl history with progress
 */
export async function updateCrawlHistory(
  historyId: string,
  updates: Partial<NewCrawlHistory>
): Promise<void> {
  const db = await getDbAsync();
  
  await db.update(crawlHistory)
    .set(updates)
    .where(eq(crawlHistory.id, historyId));
}

/**
 * Get pending crawl records
 */
export async function getPendingCrawlRecords(
  type?: CrawlType,
  limit: number = 100
): Promise<Crawl[]> {
  const db = await getDbAsync();
  
  const conditions = [eq(crawl.status, CrawlStatus.PENDING)];
  if (type) {
    conditions.push(eq(crawl.type, type));
  }
  
  return await db.select()
    .from(crawl)
    .where(and(...conditions))
    .limit(limit);
}

/**
 * Update crawl record status and content
 */
export async function updateCrawlRecord(
  id: string,
  updates: Partial<NewCrawl>
): Promise<void> {
  const db = await getDbAsync();
  
  await db.update(crawl)
    .set(updates)
    .where(eq(crawl.id, id));
}

/**
 * Create crawl records for torrent detail pages
 */
export async function createTorrentDetailCrawlRecords(
  torrentUrls: string[]
): Promise<string[]> {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  
  // To avoid individual checks, we can use a subquery or a single IN query to find existing URLs
  const existingRecords = await db.select({ url: crawl.url })
    .from(crawl)
    .where(eq(crawl.url, torrentUrls[0])); // This is just for one, better to use IN if many
  
  // A better way with Drizzle is to just try inserting and ignore conflicts if unique constraint exists
  // For SQLite, we can't easily do ON CONFLICT in Drizzle's insert without custom SQL if not supported
  
  const newRecords: NewCrawl[] = [];
  for (const url of torrentUrls) {
    // We still do a quick check to avoid unnecessary inserts if many are duplicates
    const existing = await getCrawlRecordByUrl(url);
    if (!existing) {
      newRecords.push({
        id: uuidv4(),
        url,
        status: CrawlStatus.PENDING,
        type: CrawlType.TORRENT_DETAILS,
        createdAt: now
      });
    }
  }
  
  if (newRecords.length > 0) {
    await db.insert(crawl).values(newRecords);
    console.log(`Created ${newRecords.length} detail crawl records`);
  }
  
  return newRecords.map(r => r.id);
}

/**
 * Get crawl record by URL
 */
export async function getCrawlRecordByUrl(url: string): Promise<Crawl | null> {
  const db = await getDbAsync();
  
  const results = await db.select().from(crawl).where(eq(crawl.url, url));
  
  if (results.length === 0) {
    return null;
  }
  
  return results[0];
}

/**
 * Get crawl statistics
 */
export async function getCrawlStatistics(): Promise<{
  total: number;
  pending: number;
  completed: number;
  error: number;
}> {
  const db = await getDbAsync();
  
  // Using custom SQL for efficient counting
  const results = await db.select({
    status: crawl.status,
    count: sql<number>`count(*)`
  })
  .from(crawl)
  .groupBy(crawl.status);
  
  const stats = {
    total: 0,
    pending: 0,
    completed: 0,
    error: 0
  };
  
  results.forEach(r => {
    const count = Number(r.count);
    stats.total += count;
    if (r.status === CrawlStatus.PENDING) stats.pending = count;
    else if (r.status === CrawlStatus.COMPLETED) stats.completed = count;
    else if (r.status === CrawlStatus.ERROR) stats.error = count;
  });
  
  return stats;
}

/**
 * Count torrent links found in forum pages
 */
export async function countTorrentLinks(): Promise<number> {
  const db = await getDbAsync();
  
  const result = await db.select({
    count: sql<number>`count(*)`
  })
  .from(crawl)
  .where(eq(crawl.type, CrawlType.TORRENT_DETAILS));
  
  return Number(result[0]?.count || 0);
}

/**
 * Mark crawl record as completed with HTML content
 */
export async function markCrawlRecordCompleted(
  id: string,
  html: string,
  codePage: string = 'windows-1251'
): Promise<void> {
  await updateCrawlRecord(id, {
    status: CrawlStatus.COMPLETED,
    htmlBody: html,
    codePage
  });
}

/**
 * Mark crawl record as failed with error message
 */
export async function markCrawlRecordFailed(
  id: string,
  error: string
): Promise<void> {
  await updateCrawlRecord(id, {
    status: CrawlStatus.ERROR,
    htmlBody: error
  });
}