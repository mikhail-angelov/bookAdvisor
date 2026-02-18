/**
 * Main orchestrator for the crawler
 */

import * as cheerio from 'cheerio';
import { fetchUrl, fetchUrls } from './fetcher';
import * as repository from './repository';
import { CrawlConfig, CrawlType, CrawlStatus } from './types';

/**
 * Extract torrent URLs from forum page HTML
 */
function extractTorrentUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  
  // Find all torrent topic links in forum page
  $('tr.hl-tr a[href*="viewtopic.php"]').each((_, link) => {
    const href = $(link).attr('href');
    if (href) {
      // Make absolute URL if relative
      const absoluteUrl = href.startsWith('http') 
        ? href 
        : `https://rutracker.org/forum/${href}`;
      urls.push(absoluteUrl);
    }
  });
  
  // Remove duplicates (some pages may have multiple links to same topic)
  return Array.from(new Set(urls));
}

/**
 * Main crawler function
 */
export async function main(config: CrawlConfig): Promise<void> {
  const startTime = new Date();
  console.log(`Starting crawler at ${startTime.toISOString()}`);
  console.log(`Config: ${JSON.stringify(config, null, 2)}`);

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

  // Step 3: Fetch and process forum pages
  console.log('Fetching forum pages...');
  const forumPagesProcessed = await processForumPages(
    forumPageIds,
    config,
    historyId
  );

  // Step 4: Count torrent links found
  const torrentLinksCount = await repository.countTorrentLinks();
  console.log(`Total torrent links found: ${torrentLinksCount}`);

  // Step 5: Fetch torrent detail pages
  console.log('Fetching torrent detail pages...');
  const detailsProcessed = await processTorrentDetails(config, historyId);

  // Step 6: Update crawl history as completed
  const completedAt = new Date().toISOString();
  await repository.updateCrawlHistory(historyId, {
    pagesCrawled: forumPagesProcessed,
    torrentsFound: torrentLinksCount,
    completedAt,
    status: 'completed'
  });

  // Step 7: Print final statistics
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);
  const durationSeconds = Math.floor((durationMs % 60000) / 1000);

  console.log('\n=== CRAWL COMPLETED ===');
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`End time: ${endTime.toISOString()}`);
  console.log(`Duration: ${durationMinutes}m ${durationSeconds}s`);
  console.log(`Forum pages processed: ${forumPagesProcessed}`);
  console.log(`Torrent links found: ${torrentLinksCount}`);
  console.log(`Torrent details processed: ${detailsProcessed}`);

  const stats = await repository.getCrawlStatistics();
  console.log(`\nDatabase statistics:`);
  console.log(`  Total records: ${stats.total}`);
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  Completed: ${stats.completed}`);
  console.log(`  Error: ${stats.error}`);
}

/**
 * Process forum pages: fetch, parse, extract torrent links
 */
async function processForumPages(
  forumPageIds: string[],
  config: CrawlConfig,
  historyId: string
): Promise<number> {
  console.log(`Processing ${forumPageIds.length} forum pages...`);
  let processedCount = 0;
  let totalTorrentLinks = 0;

  // Process pages in batches based on concurrency setting
  const batchSize = config.concurrentRequests || 5;
  
  for (let i = 0; i < forumPageIds.length; i += batchSize) {
    const batchIds = forumPageIds.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(forumPageIds.length / batchSize)}`);

    // Simplified: Get all pending forum page records for this batch
    const pendingRecords = await repository.getPendingCrawlRecords(CrawlType.FORUM_PAGE, 100);
    const batchRecordsFiltered = pendingRecords.filter(record => batchIds.includes(record.id));

    if (batchRecordsFiltered.length === 0) {
      console.log(`No pending records found for this batch, skipping...`);
      continue;
    }

    // Fetch each page
    for (const record of batchRecordsFiltered) {
      console.log(`Processing forum page: ${record.url}`);
      
      try {
        // Fetch the page
        const fetchResult = await fetchUrl(record.url, {
          retryAttempts: config.retryAttempts,
          retryDelayMs: config.retryDelayMs
        });

        if (fetchResult.error) {
          // Mark as failed
          await repository.markCrawlRecordFailed(record.id, fetchResult.error);
          console.error(`Failed to fetch ${record.url}: ${fetchResult.error}`);
          continue;
        }

        // Mark as completed
        await repository.markCrawlRecordCompleted(
          record.id,
          fetchResult.html,
          fetchResult.encoding
        );

        // Parse torrent links from the HTML
        const torrentUrls = extractTorrentUrls(fetchResult.html);
        console.log(`Found ${torrentUrls.length} torrents on page ${record.url}`);
        
        if (torrentUrls.length > 0) {
          // Create crawl records for torrent detail pages
          await repository.createTorrentDetailCrawlRecords(torrentUrls);
          totalTorrentLinks += torrentUrls.length;
        }

        processedCount++;
        
        // Update progress
        console.log(`Progress: ${processedCount}/${forumPageIds.length} forum pages processed, ${totalTorrentLinks} torrent links found`);

        // Update crawl history with current progress
        await repository.updateCrawlHistory(historyId, {
          pagesCrawled: processedCount,
          torrentsFound: totalTorrentLinks
        });

      } catch (error: any) {
        console.error(`Error processing ${record.url}:`, error.message);
        await repository.markCrawlRecordFailed(record.id, error.message);
      }
    }

    // Small delay between batches
    if (i + batchSize < forumPageIds.length) {
      if (process.env.NODE_ENV !== 'test') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  return processedCount;
}

/**
 * Process torrent detail pages
 */
async function processTorrentDetails(
  config: CrawlConfig,
  historyId: string
): Promise<number> {
  console.log('Starting torrent detail page processing...');
  let processedCount = 0;
  let errorCount = 0;

  // Get pending torrent detail records
  const pendingDetails = await repository.getPendingCrawlRecords(CrawlType.TORRENT_DETAILS);
  console.log(`Found ${pendingDetails.length} pending torrent detail pages`);

  if (pendingDetails.length === 0) {
    console.log('No torrent detail pages to process');
    return 0;
  }

  // Process in batches
  const batchSize = config.concurrentRequests || 5;
  
  for (let i = 0; i < pendingDetails.length; i += batchSize) {
    const batch = pendingDetails.slice(i, i + batchSize);
    console.log(`Processing torrent details batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(pendingDetails.length / batchSize)}`);

    // Fetch all pages in batch concurrently
    const fetchPromises = batch.map(record => 
      fetchUrl(record.url, {
        retryAttempts: config.retryAttempts,
        retryDelayMs: config.retryDelayMs
      }).then(async (fetchResult) => {
        if (fetchResult.error) {
          await repository.markCrawlRecordFailed(record.id, fetchResult.error);
          errorCount++;
          return { success: false, id: record.id };
        } else {
          await repository.markCrawlRecordCompleted(
            record.id,
            fetchResult.html,
            fetchResult.encoding
          );
          processedCount++;
          return { success: true, id: record.id };
        }
      }).catch(async (error) => {
        await repository.markCrawlRecordFailed(record.id, error.message);
        errorCount++;
        return { success: false, id: record.id };
      })
    );

    const results = await Promise.all(fetchPromises);
    const successful = results.filter(r => r.success).length;

    console.log(`Batch completed: ${successful} successful, ${results.length - successful} failed`);
    console.log(`Total progress: ${processedCount}/${pendingDetails.length} details processed, ${errorCount} errors`);

    // Total count of torrents discovered is already in the database
    // No need to update history during detail processing unless we track detail progress specifically

    // Small delay between batches
    if (i + batchSize < pendingDetails.length) {
      if (process.env.NODE_ENV !== 'test') {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  console.log(`Torrent detail processing complete: ${processedCount} successful, ${errorCount} errors`);
  return processedCount;
}

/**
 * Extract torrent links from HTML using parser
 */
