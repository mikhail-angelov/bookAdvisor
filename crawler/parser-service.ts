/**
 * Service to process crawled HTML and populate the books table
 */

import { v4 as uuidv4 } from 'uuid';
import { RutrackerParser, RutrackerDetailsParser } from './parsers';
import { getCompletedCrawls, batchUpsertBooks } from './repository';
import { CrawlType } from './types';
import { NewBook } from '../db/schema';

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
  
  // 2. Parse forum pages (torrents-page)
  for (const crawl of forumCrawls) {
    if (!crawl.htmlBody) continue;
    
    const forumIdMatch = crawl.url.match(/f=(\d+)/);
    const forumId = forumIdMatch ? parseInt(forumIdMatch[1], 10) : 0;
    
    const parsedBooks = forumParser.parse(crawl.htmlBody, forumId);
    
    for (const b of parsedBooks) {
      if (!b.url) continue;
      booksMap.set(b.url, {
        id: uuidv4(),
        crawlId: crawl.id,
        createdAt: new Date().toISOString(),
        title: '', // Default values to satisfy NewBook type if parser missed them
        category: 'Российская фантастика',
        ...b
      } as NewBook);
    }
  }
  
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
}
