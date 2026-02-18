/**
 * Main orchestrator for the crawler
 */

import * as cheerio from 'cheerio';
import { fetchUrl } from './fetcher';
import { FetchOptions } from './fetcher';
import * as repository from './repository';
import { CrawlConfig, CrawlType } from './types';
import type { Crawl } from '../db/schema';

const RUTRACKER_BASE = 'https://rutracker.org/forum';

/**
 * Extract unique torrent topic URLs from a forum page.
 */
function extractTorrentUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();

  $('tr.hl-tr a.torTopic[href*="viewtopic.php"]').each((_, link) => {
    const href = $(link).attr('href');
    if (!href) return;
    const url = href.startsWith('http') ? href : `${RUTRACKER_BASE}/${href}`;
    seen.add(url);
  });

  return Array.from(seen);
}

/**
 * Process a list of crawl records: fetch each URL, mark complete/failed,
 * and optionally run a callback on successful HTML.
 */
async function processCrawlRecords(
  records: Crawl[],
  fetchOptions: FetchOptions,
  batchSize: number,
  onSuccess?: (record: Crawl, html: string) => Promise<void>
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (record) => {
        try {
          const result = await fetchUrl(record.url, fetchOptions);
          if (result.error) {
            await repository.markCrawlRecordFailed(record.id, result.error);
            errors++;
          } else {
            await repository.markCrawlRecordCompleted(record.id, result.html, result.encoding);
            processed++;
            await onSuccess?.(record, result.html);
          }
        } catch (err: any) {
          await repository.markCrawlRecordFailed(record.id, err.message);
          errors++;
        }
      })
    );

    // Polite delay between batches (skip in tests)
    if (process.env.NODE_ENV !== 'test' && i + batchSize < records.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return { processed, errors };
}

/**
 * Main crawler entry point.
 */
export async function main(config: CrawlConfig): Promise<void> {
  const startTime = new Date();
  console.log(`Starting crawler at ${startTime.toISOString()}`);
  console.log(`Config: ${JSON.stringify(config, null, 2)}`);

  const fetchOptions: FetchOptions = {
    retryAttempts: config.retryAttempts,
    retryDelayMs: config.retryDelayMs,
  };
  const batchSize = config.concurrentRequests ?? 5;

  // Step 1: Create crawl history record
  console.log('Creating crawl history record...');
  const historyId = await repository.createCrawlHistory(config.forumId);
  console.log(`Crawl history created with ID: ${historyId}`);

  // Step 2: Initialize crawl records for forum pages
  console.log(`Initializing crawl records for ${config.pages} forum pages...`);
  const forumPageIds = await repository.initializeCrawlRecords(
    config.forumId,
    config.pages,
    CrawlType.FORUM_PAGE
  );
  console.log(`Created ${forumPageIds.length} forum page crawl records`);

  // Step 3: Fetch forum pages and collect torrent links
  console.log('Fetching forum pages...');
  const forumRecords = await repository.getPendingCrawlRecords(CrawlType.FORUM_PAGE);
  let torrentLinksFound = 0;

  const { processed: forumProcessed } = await processCrawlRecords(
    forumRecords,
    fetchOptions,
    batchSize,
    async (_record, html) => {
      const urls = extractTorrentUrls(html);
      if (urls.length > 0) {
        await repository.createFreshTorrentDetailCrawlRecords(urls);
        torrentLinksFound += urls.length;
        console.log(`Found ${urls.length} torrent links (total: ${torrentLinksFound})`);
      }
    }
  );

  console.log(`Forum pages processed: ${forumProcessed}, torrent links found: ${torrentLinksFound}`);
  await repository.updateCrawlHistory(historyId, {
    pagesCrawled: forumProcessed,
    torrentsFound: torrentLinksFound,
  });

  // Step 4: Fetch torrent detail pages
  console.log('Fetching torrent detail pages...');
  const detailRecords = await repository.getPendingCrawlRecords(CrawlType.TORRENT_DETAILS);
  console.log(`Found ${detailRecords.length} pending torrent detail pages`);

  const { processed: detailProcessed, errors: detailErrors } = await processCrawlRecords(
    detailRecords,
    fetchOptions,
    batchSize
  );

  console.log(`Torrent details: ${detailProcessed} processed, ${detailErrors} errors`);

  // Step 5: Finalize crawl history
  await repository.updateCrawlHistory(historyId, {
    completedAt: new Date().toISOString(),
    status: 'completed',
  });

  // Step 6: Print summary
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);
  const durationSeconds = Math.floor((durationMs % 60000) / 1000);

  const stats = await repository.getCrawlStatistics();

  console.log('\n=== CRAWL COMPLETED ===');
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`End time: ${endTime.toISOString()}`);
  console.log(`Duration: ${durationMinutes}m ${durationSeconds}s`);
  console.log(`Forum pages processed: ${forumProcessed}`);
  console.log(`Torrent links found: ${torrentLinksFound}`);
  console.log(`Torrent details processed: ${detailProcessed}`);
  console.log(`\nDatabase statistics:`);
  console.log(`  Total records: ${stats.total}`);
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  Completed: ${stats.completed}`);
  console.log(`  Error: ${stats.error}`);
}
