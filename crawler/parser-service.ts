/**
 * Service to process crawled HTML and populate the books table
 */

import { v4 as uuidv4 } from 'uuid';
import * as iconv from 'iconv-lite';
import { RutrackerParser, RutrackerDetailsParser } from './parsers';
import { getCompletedCrawls, batchUpsertBooks, updateBooks } from './repository';
import { CrawlType } from './types';
import { NewBook } from '../db/schema';
import type { Crawl } from '../db/schema';

/**
 * Ensure HTML string is properly decoded.
 * If the crawl was stored with windows-1251 codePage but the text looks like
 * it was mis-decoded (contains replacement characters), attempt re-decoding
 * by treating the string as latin1 bytes and re-decoding with iconv.
 */
function getDecodedHtml(crawl: Crawl): string {
  const html = crawl.htmlBody ?? '';
  if (!html) return html;

  // If codePage is windows-1251 and the HTML contains replacement chars (U+FFFD or ?)
  // it was likely stored with wrong encoding — re-decode from latin1 bytes
  if (crawl.codePage === 'windows-1251' && html.includes('\uFFFD')) {
    try {
      const bytes = Buffer.from(html, 'latin1');
      return iconv.decode(bytes, 'windows-1251');
    } catch {
      return html;
    }
  }

  return html;
}

/**
 * Process completed crawls and populate books table
 */
export async function processCrawls(forceReload: boolean = false): Promise<void> {
  console.log(`Starting crawl processing (forceReload: ${forceReload})...`);
  
  // 1. Fetch completed crawls
  const forumCrawls = await getCompletedCrawls({ 
    type: CrawlType.FORUM_PAGE, 
    excludeProcessed: !forceReload 
  });
  
  const detailCrawls = await getCompletedCrawls({ 
    type: CrawlType.TORRENT_DETAILS,
    excludeProcessed: !forceReload 
  });
  
  console.log(`Found ${forumCrawls.length} forum pages and ${detailCrawls.length} detail pages to process.`);
  
  if (forumCrawls.length === 0 && detailCrawls.length === 0) {
    console.log('No new crawls to process.');
    return;
  }
  
  const forumParser = new RutrackerParser();
  const detailParser = new RutrackerDetailsParser();
  
  // Map to store combined book data, keyed by URL
  const booksMap = new Map<string, NewBook>();
  
  // 3. Parse detail pages (torrent-details)
  for (const crawl of detailCrawls) {
    if (!crawl.htmlBody) continue;
    
    const topicIdMatch = crawl.url.match(/t=(\d+)/);
    const topicId = topicIdMatch ? topicIdMatch[1] : undefined;
    
    const details = detailParser.parse(crawl.htmlBody, topicId);
    
    const existing = booksMap.get(crawl.url) || {
      id: uuidv4(),
      crawlId: crawl.id,
      url: crawl.url,
      title: '',
      category: 'Российская фантастика',
      createdAt: new Date().toISOString(),
    } as NewBook;
    
    // Merge details
    booksMap.set(crawl.url, {
      ...existing,
      ...details,
      // Ensure we don't overwrite if details has empty fields but existing has data
      title: details.title || details.topicTitle || existing.title || '',
      category: details.category || existing.category || 'Российская фантастика',
    } as NewBook);
  }
  
  // 4. Batch upsert into database
  const booksToUpsert = Array.from(booksMap.values());
  
  if (booksToUpsert.length > 0) {
    await batchUpsertBooks(booksToUpsert);
    console.log(`Processed and saved ${booksToUpsert.length} books.`);
  } else {
    console.log('No books extracted from crawls.');
  }

  // 5. Parse forum pages (torrents-page) and update status
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

      const booksToUpdate = Array.from(updateBooksMap.values());
  
  if (booksToUpsert.length > 0) {
    await updateBooks(booksToUpdate);
    console.log(`Processed and saved ${booksToUpsert.length} books.`);
  } else {
    console.log('No books extracted from crawls.');
  }
    
  }


}
