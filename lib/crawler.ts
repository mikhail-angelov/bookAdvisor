import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";
import * as iconv from "iconv-lite";
import {
  insertTorrent,
  insertCrawlHistory,
  updateCrawlHistory,
  torrentExistsByTopicId,
  bulkUpsertTorrents,
  bulkCheckTopicIds,
  insertCrawlRecord,
  insertTorrentDetails,
} from "@/db/queries";
import { ParserFactory, TorrentData } from "./parsers";
import { DetailsParserFactory } from "./details-parser";

// Re-export TorrentData type for external use
export type { TorrentData } from "./parsers";

const RUTRACKER_BASE_URL = "https://rutracker.org/forum";

// Default parser instance
const defaultParser = ParserFactory.getDefaultParser();
const defaultDetailsParser = DetailsParserFactory.getDefaultParser();

// Emit status update via socket.io if available
function emitStatusUpdate() {
  const status = getCrawlerStatus();
  if (typeof global !== "undefined" && (global as any).updateCrawlerStatus) {
    (global as any).updateCrawlerStatus(status);
  }
}

interface CrawlerState {
  isRunning: boolean;
  currentPage: number;
  totalPages: number;
  torrentsFound: number;
  errors: string[];
  startTime: Date | null;
}

export const crawlerState: CrawlerState = {
  isRunning: false,
  currentPage: 0,
  totalPages: 0,
  torrentsFound: 0,
  errors: [],
  startTime: null,
};

export interface TorrentDetailsData {
  url: string;
  description: string;
  category: string;
  forumName: string;
  registeredUntil: string;
  seeders: number;
  magnetLink: string;
  torrentFile: string;
  authorName: string;
  authorPosts: number;
  topicTitle: string;
  year: number | null;
  authorFirstName: string;
  authorLastName: string;
  performer: string;
  series: string;
  bookNumber: string;
  genre: string;
  editionType: string;
  audioCodec: string;
  bitrate: string;
  duration: string;
  size?: string;
  author?: string;
}

function parseNumber(numStr: string): number {
  const cleaned = numStr.replace(/[^\d]/g, "");
  return parseInt(cleaned, 10) || 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function crawlForumPage(
  forumId: number,
  page: number,
): Promise<TorrentData[]> {
  const url = `${RUTRACKER_BASE_URL}/viewforum.php?f=${forumId}&start=${page * 50}`;
  const crawlTime = new Date().toISOString();

  console.log(`Crawling: ${url}`);

  try {
    // Request as arraybuffer to handle encoding properly
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      responseType: "arraybuffer",
      timeout: 30000,
    });

    // Detect encoding from Content-Type header or default to windows-1251 (common for Russian sites)
    const contentType = response.headers["content-type"] || "";
    let encoding = "win1251"; // Default for Rutracker

    // Check if charset is specified in Content-Type
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      encoding = charsetMatch[1].toLowerCase();
    }

    console.log(`[CRAWL] Detected encoding: ${encoding}`);

    // Decode the response using iconv-lite
    const htmlBuffer = response.data;
    const html = iconv.decode(htmlBuffer, encoding);

    // Save crawl record to database
    try {
      await insertCrawlRecord({
        id: uuidv4(),
        url,
        time: crawlTime,
        codePage: encoding,
        htmlBody: html,
      });
      console.log(`[CRAWL] Saved crawl record for ${url}`);
    } catch (dbError) {
      console.error(`[CRAWL] Failed to save crawl record:`, dbError);
    }

    // Use the parser to extract torrents from HTML
    const torrents = defaultParser.parse(html, forumId);

    return torrents;
  } catch (error) {
    console.error(`Error crawling page ${page}:`, error);
    throw error;
  }
}

export async function crawlTopicDetails(
  topicId: string,
): Promise<TorrentDetailsData | null> {
  const url = `${RUTRACKER_BASE_URL}/viewtopic.php?t=${topicId}`;
  const crawlTime = new Date().toISOString();

  try {
    // Request as arraybuffer to handle encoding properly
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      responseType: "arraybuffer",
      timeout: 30000,
    });

    // Detect encoding from Content-Type header or default to windows-1251
    const contentType = response.headers["content-type"] || "";
    let encoding = "win1251";

    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      encoding = charsetMatch[1].toLowerCase();
      // Normalize encoding names for iconv-lite
      if (encoding === "windows-1251") {
        encoding = "win1251";
      }
    }

    // Decode the response using iconv-lite
    const htmlBuffer = response.data;
    const html = iconv.decode(htmlBuffer, encoding);

    // Save crawl record to database
    try {
      await insertCrawlRecord({
        id: uuidv4(),
        url,
        time: crawlTime,
        codePage: encoding,
        htmlBody: html,
      });
      console.log(`[CRAWL] Saved crawl record for ${url}`);
    } catch (dbError) {
      console.error(`[CRAWL] Failed to save crawl record:`, dbError);
    }

    // Use the details parser to extract torrent details from HTML
    const details = defaultDetailsParser.parse(html, topicId);

    return details;
  } catch (error) {
    console.error(`Error crawling topic details for ${topicId}:`, error);
    return null;
  }
}


/**
 * Crawl torrent details page and store results in database
 */
export async function crawlAndStoreTopicDetails(topicId: string): Promise<boolean> {
  const details = await crawlTopicDetails(topicId);
  if (!details) {
    return false;
  }

  try {
    // Map parsed details to database schema
    const now = new Date().toISOString();
    await insertTorrentDetails({
      id: topicId, // Use topicId as primary key for upsert
      torrentId: topicId,
      url: details.url,
      description: details.description,
      category: details.category,
      forumName: details.forumName,
      registeredUntil: details.registeredUntil,
      seeders: details.seeders,
      lastChecked: now,
      magnetLink: details.magnetLink,
      torrentFile: details.torrentFile,
      size: details.size ?? null,
      createdAt: now,
      authorName: details.authorName,
      authorPosts: details.authorPosts,
      topicTitle: details.topicTitle,
      year: details.year,
      authorFirstName: details.authorFirstName,
      authorLastName: details.authorLastName,
      performer: details.performer,
      series: details.series,
      bookNumber: details.bookNumber,
      genre: details.genre,
      editionType: details.editionType,
      audioCodec: details.audioCodec,
      bitrate: details.bitrate,
      duration: details.duration,
    });
    console.log(`[DETAILS] Stored details for topic ${topicId}`);
    return true;
  } catch (error) {
    console.error(`Failed to store details for topic ${topicId}:`, error);
    return false;
  }
}

/**
 * Crawl details for multiple torrents with concurrency limit
 */
export async function crawlDetailsBatch(
  topicIds: string[],
  concurrency: number = 3,
  delayBetweenRequests: number = 2000
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  const queue = [...topicIds];
  
  async function processQueue() {
    while (queue.length > 0) {
      const topicId = queue.shift();
      if (!topicId) continue;
      
      try {
        const ok = await crawlAndStoreTopicDetails(topicId);
        if (ok) success++;
        else failed++;
      } catch (error) {
        console.error(`Error processing topic ${topicId}:`, error);
        failed++;
      }
      
      // Rate limiting between requests
      if (queue.length > 0) {
        await delay(delayBetweenRequests + Math.random() * 1000);
      }
    }
  }
  
  // Start workers up to concurrency limit
  const workers = Array(Math.min(concurrency, topicIds.length)).fill(0).map(processQueue);
  await Promise.all(workers);
  
  return { success, failed };
}

export async function startCrawl(
  forumId: number,
  maxPages: number = 10,
): Promise<void> {
  const crawlId = uuidv4();
  const startTime = Date.now();

  console.log(`[CRAWL:${crawlId}] ========== STARTING CRAWL ==========`);
  console.log(
    `[CRAWL:${crawlId}] Forum ID: ${forumId}, Max Pages: ${maxPages}`,
  );

  if (crawlerState.isRunning) {
    const error = "Crawler is already running";
    console.error(`[CRAWL:${crawlId}] ${error}`);
    throw new Error(error);
  }

  crawlerState.isRunning = true;
  crawlerState.currentPage = 0;
  crawlerState.totalPages = maxPages;
  crawlerState.torrentsFound = 0;
  crawlerState.errors = [];
  crawlerState.startTime = new Date();

  const now = new Date().toISOString();

  // Record crawl start in history
  insertCrawlHistory({
    id: crawlId,
    forumId: forumId,
    pagesCrawled: 0,
    torrentsFound: 0,
    startedAt: now,
    completedAt: null,
    status: "running",
    createdAt: now,
  });

  emitStatusUpdate();
  console.log(`[CRAWL:${crawlId}] Crawl initialized, emitting status`);

  try {
    for (let page = 0; page < maxPages; page++) {
      const pageStartTime = Date.now();

      if (!crawlerState.isRunning) {
        console.log(`[CRAWL:${crawlId}] Crawl stopped by user at page ${page}`);
        break;
      }

      crawlerState.currentPage = page;
      console.log(
        `[CRAWL:${crawlId}] Starting page ${page + 1}/${maxPages} (forum: ${forumId})`,
      );
      emitStatusUpdate();

      // Rate limiting - wait between requests
      const delayMs = 2000 + Math.random() * 1000;
      console.log(
        `[CRAWL:${crawlId}] Rate limiting: waiting ${Math.round(delayMs)}ms`,
      );
      await delay(delayMs);

      try {
        const torrents = await crawlForumPage(forumId, page);
        const pageDuration = Date.now() - pageStartTime;

        console.log(
          `[CRAWL:${crawlId}] Page ${page + 1} completed in ${pageDuration}ms, found ${torrents.length} torrents`,
        );

        if (torrents.length === 0) {
          console.log(
            `[CRAWL:${crawlId}] No more torrents found on page ${page + 1}, stopping...`,
          );
          break;
        }

        // Use bulk upsert to efficiently handle both new and existing records
        const nowStr = new Date().toISOString();

        // Prepare torrent data for bulk upsert (using camelCase for ORM)
        const torrentData = torrents.map((torrent) => ({
          id: uuidv4(),
          topicId: torrent.topicId,
          url: torrent.url,
          title: torrent.title,
          forumId: torrent.forumId,
          size: torrent.size,
          seeds: torrent.seeds,
          leechers: torrent.leechers,
          downloads: torrent.downloads,
          author: torrent.author,
          createdAt: torrent.createdAt,
          lastUpdated: nowStr,
          status: "active",
        }));

        // Bulk upsert all torrents (new records get inserted, existing records get updated)
        const result = await bulkUpsertTorrents(torrentData);

        // Total count includes both inserted and updated records
        crawlerState.torrentsFound += result.inserted + result.updated;

        // Log details about inserted vs updated
        if (result.inserted > 0) {
          console.log(
            `[CRAWL:${crawlId}] Inserted ${result.inserted} new torrent(s)`,
          );
        }
        if (result.updated > 0) {
          console.log(
            `[CRAWL:${crawlId}] Updated ${result.updated} existing torrent(s)`,
          );
        }

        console.log(
          `[CRAWL:${crawlId}] Page ${page + 1} summary: ${result.inserted} new, ${result.updated} updated, total: ${crawlerState.torrentsFound}`,
        );

        // Update history
        updateCrawlHistory(crawlId, {
          pagesCrawled: page + 1,
          torrentsFound: crawlerState.torrentsFound,
        });

        emitStatusUpdate();

        // Crawl details for torrents on this page
        const topicIds = torrents.map(t => t.topicId);
        console.log(`[CRAWL:${crawlId}] Crawling details for ${topicIds.length} torrents...`);
        const detailsResult = await crawlDetailsBatch(topicIds, 3, 2000);
        console.log(`[CRAWL:${crawlId}] Details crawl completed: ${detailsResult.success} succeeded, ${detailsResult.failed} failed`);

      } catch (pageError: any) {
        const errorMsg = pageError.message || "Unknown error";
        const isTimeout =
          errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT");
        const isNetwork =
          errorMsg.includes("network") || errorMsg.includes("ENOTFOUND");

        console.error(
          `[CRAWL:${crawlId}] ERROR on page ${page + 1}:`,
          errorMsg,
        );
        console.error(
          `[CRAWL:${crawlId}] Error type: ${isTimeout ? "TIMEOUT" : isNetwork ? "NETWORK" : "OTHER"}`,
        );

        crawlerState.errors.push(`Page ${page + 1}: ${errorMsg}`);
        emitStatusUpdate();

        // Continue to next page on timeout/network errors
        if (isTimeout || isNetwork) {
          console.log(
            `[CRAWL:${crawlId}] Continuing to next page after ${isTimeout ? "timeout" : "network error"}`,
          );
          continue;
        }

        // Re-throw for critical errors
        throw pageError;
      }
    }

    const totalDuration = Date.now() - startTime;

    // Mark crawl as completed
    updateCrawlHistory(crawlId, {
      completedAt: new Date().toISOString(),
      status: "completed",
    });

    console.log(`[CRAWL:${crawlId}] ========== CRAWL COMPLETED ==========`);
    console.log(
      `[CRAWL:${crawlId}] Total duration: ${Math.round(totalDuration / 1000)}s`,
    );
    console.log(
      `[CRAWL:${crawlId}] Pages crawled: ${crawlerState.currentPage + 1}`,
    );
    console.log(
      `[CRAWL:${crawlId}] Total torrents found: ${crawlerState.torrentsFound}`,
    );
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    const stack = error.stack || "";

    console.error(`[CRAWL:${crawlId}] ========== CRAWL ERROR ==========`);
    console.error(`[CRAWL:${crawlId}] Error: ${errorMsg}`);
    console.error(`[CRAWL:${crawlId}] Stack: ${stack}`);

    crawlerState.errors.push(errorMsg);

    updateCrawlHistory(crawlId, {
      completedAt: new Date().toISOString(),
      status: "error",
    });

    emitStatusUpdate();
  } finally {
    crawlerState.isRunning = false;
    emitStatusUpdate();
    console.log(`[CRAWL:${crawlId}] Crawler state reset to idle`);
  }
}

export function stopCrawl(): void {
  crawlerState.isRunning = false;
}

export function getCrawlerStatus() {
  return {
    ...crawlerState,
    duration: crawlerState.startTime
      ? Date.now() - crawlerState.startTime.getTime()
      : 0,
  };
}

/**
 * Reparse crawled HTML data from database
 * This is useful when parser logic has changed and you want to update existing data
 */
export async function reparseCrawlData(forumId: number): Promise<{
  recordsProcessed: number;
  torrentsProcessed: number;
  torrentsUpdated: number;
}> {
  if (crawlerState.isRunning) {
    throw new Error('Crawler is currently running. Stop the crawl before re-parsing.');
  }

  // Import here to avoid circular dependencies
  const { getCrawlRecordsForReparse, bulkUpsertTorrents, insertTorrentDetails } = await import('@/db/queries');
  const { ParserFactory } = await import('./parsers');
  const { DetailsParserFactory } = await import('./details-parser');
  const { v4: uuidv4 } = await import('uuid');

  // Get all crawl records for this forum (including topic pages)
  const crawlRecords = await getCrawlRecordsForReparse(forumId);
  
  if (crawlRecords.length === 0) {
    console.log(`[REPARSE] No crawl records found for forum ${forumId}`);
    return {
      recordsProcessed: 0,
      torrentsProcessed: 0,
      torrentsUpdated: 0,
    };
  }

  console.log(`[REPARSE] Found ${crawlRecords.length} crawl records for forum ${forumId}`);

  // Use the default parsers
  const parser = ParserFactory.getDefaultParser();
  const detailsParser = DetailsParserFactory.getDefaultParser();
  let totalTorrentsProcessed = 0;
  let totalTorrentsUpdated = 0;
  let totalDetailsProcessed = 0;
  let totalDetailsUpdated = 0;

  // Process each crawl record
  for (const record of crawlRecords) {
    console.log(`[REPARSE] Processing record ${record.id}, URL: ${record.url}`);
    if (!record.htmlBody) {
      console.log(`[REPARSE] Skipping record ${record.id} - no HTML content`);
      continue;
    }

    // Determine if this is a forum page or topic page
    const isTopicPage = record.url.includes('viewtopic.php');
    console.log(`[REPARSE] isTopicPage: ${isTopicPage}`);

    try {
      if (isTopicPage) {
        // Parse topic page with details parser
        const topicIdMatch = record.url.match(/t=(\d+)/);
        if (!topicIdMatch) {
          console.log(`[REPARSE] Skipping topic page ${record.id} - no topic ID in URL`);
          continue;
        }
        const topicId = topicIdMatch[1];
        const details = detailsParser.parse(record.htmlBody, topicId);
        console.log(`[REPARSE] Parsed details for topic ${topicId}, size: ${details.size}`);
        
        // Map parsed details to database schema
        const now = new Date().toISOString();
        await insertTorrentDetails({
          id: topicId,
          torrentId: topicId,
          url: details.url,
          description: details.description,
          category: details.category,
          forumName: details.forumName,
          registeredUntil: details.registeredUntil,
          seeders: details.seeders,
          lastChecked: now,
          magnetLink: details.magnetLink,
          torrentFile: details.torrentFile,
          size: details.size ?? null,
          createdAt: now,
          authorName: details.authorName,
          authorPosts: details.authorPosts,
          topicTitle: details.topicTitle,
          year: details.year,
          authorFirstName: details.authorFirstName,
          authorLastName: details.authorLastName,
          performer: details.performer,
          series: details.series,
          bookNumber: details.bookNumber,
          genre: details.genre,
          editionType: details.editionType,
          audioCodec: details.audioCodec,
          bitrate: details.bitrate,
          duration: details.duration,
        });
        totalDetailsProcessed++;
        totalDetailsUpdated++; // insert or update counts as updated
        console.log(`[REPARSE] Record ${record.id}: topic details parsed and stored`);
      } else {
        // Parse forum page with list parser
        const torrents = parser.parse(record.htmlBody, forumId);
        
        if (torrents.length === 0) {
          console.log(`[REPARSE] No torrents parsed from record ${record.id}`);
          continue;
        }

        // Prepare torrent data for bulk upsert
        const nowStr = new Date().toISOString();
        const torrentData = torrents.map((torrent) => ({
          id: uuidv4(),
          topicId: torrent.topicId,
          url: torrent.url,
          title: torrent.title,
          forumId: torrent.forumId,
          size: torrent.size,
          seeds: torrent.seeds,
          leechers: torrent.leechers,
          downloads: torrent.downloads,
          commentsCount: torrent.commentsCount,
          lastCommentDate: torrent.lastCommentDate,
          author: torrent.author,
          createdAt: torrent.createdAt,
          lastUpdated: nowStr,
          status: 'active',
        }));

        // Bulk upsert all torrents
        const result = await bulkUpsertTorrents(torrentData);
        
        totalTorrentsProcessed += torrents.length;
        totalTorrentsUpdated += result.inserted + result.updated;

        console.log(`[REPARSE] Record ${record.id}: ${torrents.length} torrents parsed, ${result.inserted} new, ${result.updated} updated`);
      }
    } catch (error) {
      console.error(`[REPARSE] Error processing record ${record.id}:`, error);
      // Continue with other records
    }
  }

  console.log(`[REPARSE] Completed: ${totalTorrentsProcessed} torrents processed, ${totalTorrentsUpdated} total updates, ${totalDetailsProcessed} topic details processed`);
  
  return {
    recordsProcessed: crawlRecords.length,
    torrentsProcessed: totalTorrentsProcessed,
    torrentsUpdated: totalTorrentsUpdated,
  };
}

/**
 * Set a custom parser for the crawler
 * This allows for injecting different parsers for different torrent sites
 */
export function setParser(parserName: string): void {
  // This will be used to get a specific parser
  // For now we use the default Rutracker parser
  console.log(`Parser set to: ${parserName}`);
}
