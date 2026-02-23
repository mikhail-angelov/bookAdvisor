/**
 * Unit tests for repository functions
 */

import { initDatabase, closeDatabase, getCrawlDbAsync, getAppDbAsync, crawl, crawlHistory, book } from '../../db/index';
import * as repository from '../repository';
import { CrawlType, CrawlStatus } from '../types';

describe('Repository', () => {
  beforeAll(async () => {
    // Initialize in-memory test databases
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    // Clear databases before each test
    const crawlDb = await getCrawlDbAsync();
    if (crawlDb) {
      await crawlDb.delete(crawl);
      await crawlDb.delete(crawlHistory);
    }
    const appDb = await getAppDbAsync();
    if (appDb) {
      await appDb.delete(book);
    }
  });

  describe('initializeCrawlRecords', () => {
    it('should create crawl records for forum pages', async () => {
      const forumId = 2387;
      const pages = 3;
      
      const recordIds = await repository.initializeCrawlRecords(forumId, pages);
      
      expect(recordIds).toHaveLength(pages);
      
      // Verify records were created in database
      const db = await getCrawlDbAsync();
      const records = await db!.select().from(crawl);
      
      expect(records).toHaveLength(pages);
      
      // Verify URLs follow pagination pattern
      expect(records[0].url).toBe('https://rutracker.org/forum/viewforum.php?f=2387');
      expect(records[1].url).toBe('https://rutracker.org/forum/viewforum.php?f=2387&start=50');
      expect(records[2].url).toBe('https://rutracker.org/forum/viewforum.php?f=2387&start=100');
      
      // Verify default status and type
      expect(records[0].status).toBe(CrawlStatus.PENDING);
      expect(records[0].type).toBe(CrawlType.FORUM_PAGE);
    });

    it('should create records with custom type', async () => {
      const forumId = 2387;
      const pages = 1;
      const type = CrawlType.TORRENT_DETAILS;
      
      const recordIds = await repository.initializeCrawlRecords(forumId, pages, type);
      
      expect(recordIds).toHaveLength(1);
      
      const db = await getCrawlDbAsync();
      const records = await db!.select().from(crawl);
      
      expect(records[0].type).toBe(type);
    });
  });

  describe('createCrawlHistory', () => {
    it('should create a crawl history record', async () => {
      const forumId = 2387;
      
      const historyId = await repository.createCrawlHistory(forumId);
      
      expect(historyId).toBeDefined();
      
      // Verify record was created
      const db = await getCrawlDbAsync();
      const historyRecords = await db!.select().from(crawlHistory);
      
      expect(historyRecords).toHaveLength(1);
      expect(historyRecords[0].id).toBe(historyId);
      expect(historyRecords[0].forumId).toBe(forumId);
      expect(historyRecords[0].status).toBe('running');
      expect(historyRecords[0].pagesCrawled).toBe(0);
      expect(historyRecords[0].torrentsFound).toBe(0);
    });
  });

  describe('updateCrawlHistory', () => {
    it('should update crawl history record', async () => {
      const forumId = 2387;
      const historyId = await repository.createCrawlHistory(forumId);
      
      const updates = {
        pagesCrawled: 5,
        torrentsFound: 50,
        status: 'completed' as const
      };
      
      await repository.updateCrawlHistory(historyId, updates);
      
      // Verify update
      const db = await getCrawlDbAsync();
      const historyRecords = await db!.select().from(crawlHistory);
      
      expect(historyRecords[0].pagesCrawled).toBe(5);
      expect(historyRecords[0].torrentsFound).toBe(50);
      expect(historyRecords[0].status).toBe('completed');
    });
  });

  describe('getPendingCrawlRecords', () => {
    it('should return pending crawl records', async () => {
      // Create some crawl records with different statuses
      const forumId = 2387;
      await repository.initializeCrawlRecords(forumId, 2);
      
      // Mark one as completed
      const db = await getCrawlDbAsync();
      const records = await db!.select().from(crawl);
      await repository.updateCrawlRecord(records[0].id, { status: CrawlStatus.COMPLETED });
      
      // Get pending records
      const pendingRecords = await repository.getPendingCrawlRecords();
      
      expect(pendingRecords).toHaveLength(1);
      expect(pendingRecords[0].status).toBe(CrawlStatus.PENDING);
    });

    it('should filter by type', async () => {
      const forumId = 2387;
      await repository.initializeCrawlRecords(forumId, 1, CrawlType.FORUM_PAGE);
      await repository.createFreshTorrentDetailCrawlRecords([
        'https://rutracker.org/forum/viewtopic.php?t=123456'
      ]);
      
      const forumRecords = await repository.getPendingCrawlRecords(CrawlType.FORUM_PAGE);
      const detailRecords = await repository.getPendingCrawlRecords(CrawlType.TORRENT_DETAILS);
      
      expect(forumRecords).toHaveLength(1);
      expect(forumRecords[0].type).toBe(CrawlType.FORUM_PAGE);
      
      expect(detailRecords).toHaveLength(1);
      expect(detailRecords[0].type).toBe(CrawlType.TORRENT_DETAILS);
    });
  });

  describe('createTorrentDetailCrawlRecords', () => {
    it('should create crawl records for torrent detail URLs', async () => {
      const torrentUrls = [
        'https://rutracker.org/forum/viewtopic.php?t=123456',
        'https://rutracker.org/forum/viewtopic.php?t=789012'
      ];
      
      const recordIds = await repository.createFreshTorrentDetailCrawlRecords(torrentUrls);
      
      expect(recordIds).toHaveLength(2);
      
      const db = await getCrawlDbAsync();
      const records = await db!.select().from(crawl);
      
      expect(records).toHaveLength(2);
      expect(records[0].url).toBe(torrentUrls[0]);
      expect(records[0].type).toBe(CrawlType.TORRENT_DETAILS);
      expect(records[0].status).toBe(CrawlStatus.PENDING);
    });
  });

  describe('markCrawlRecordCompleted', () => {
    it('should mark record as completed with HTML content', async () => {
      const forumId = 2387;
      const recordIds = await repository.initializeCrawlRecords(forumId, 1);
      const recordId = recordIds[0];
      
      const html = '<html>Test HTML</html>';
      const codePage = 'windows-1251';
      
      await repository.markCrawlRecordCompleted(recordId, html, codePage);
      
      const db = await getCrawlDbAsync();
      const records = await db!.select().from(crawl);
      
      expect(records[0].status).toBe(CrawlStatus.COMPLETED);
      expect(records[0].htmlBody).toBe(html);
      expect(records[0].codePage).toBe(codePage);
    });
  });

  describe('markCrawlRecordFailed', () => {
    it('should mark record as failed with error message', async () => {
      const forumId = 2387;
      const recordIds = await repository.initializeCrawlRecords(forumId, 1);
      const recordId = recordIds[0];
      
      const error = 'Network timeout';
      
      await repository.markCrawlRecordFailed(recordId, error);
      
      const db = await getCrawlDbAsync();
      const records = await db!.select().from(crawl);
      
      expect(records[0].status).toBe(CrawlStatus.ERROR);
      expect(records[0].htmlBody).toBe(error);
    });
  });

  describe('getCrawlStatistics', () => {
    it('should return correct statistics', async () => {
      // Create records with different statuses
      const forumId = 2387;
      const recordIds = await repository.initializeCrawlRecords(forumId, 3);
      
      // Mark one as completed, one as error
      await repository.markCrawlRecordCompleted(recordIds[0], '<html>Test</html>');
      await repository.markCrawlRecordFailed(recordIds[1], 'Error');
      // Third remains pending
      
      const stats = await repository.getCrawlStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.error).toBe(1);
    });
  });

  describe('batchUpsertBooks', () => {
    it('should batch insert new books and skip existing URLs', async () => {
      const books = Array.from({ length: 5 }, (_, i) => ({
        id: `book-${i}`,
        title: `Book ${i}`,
        url: `https://example.com/book-${i}`,
        author: 'Author',
        status: 'new',
        crawlId: `test-crawl-id-${i}`,
        createdAt: new Date().toISOString()
      }));

      await repository.batchUpsertBooks(books as any[]);

      const db = await getAppDbAsync();
      const records = await db.select().from(book);
      
      expect(records).toHaveLength(5);

      // Now insert mixed
      const mixedBooks = [
        books[0], // existing
        {
          id: `book-100`,
          title: `Book 100`,
          url: `https://example.com/book-100`,
          author: 'Author',
          status: 'new',
          crawlId: 'test-crawl-id-100',
          createdAt: new Date().toISOString()
        }
      ];

      await repository.batchUpsertBooks(mixedBooks as any[]);
      const updatedRecords = await db.select().from(book);
      expect(updatedRecords).toHaveLength(6);
    });
  });

  describe('updateBooks', () => {
    it('should update existing books and insert missing ones', async () => {
      const now = new Date().toISOString();
      const initialBook = {
        id: 'update-book-1',
        title: 'Initial Title',
        url: 'https://example.com/update-1',
        crawlId: 'test-crawl-id-1',
        createdAt: now
      };

      const db = await getAppDbAsync();
      await db.insert(book).values(initialBook as any);

      const updates = [
        {
          url: 'https://example.com/update-1',
          title: 'Updated Title'
        },
        {
          id: 'update-book-2',
          url: 'https://example.com/update-2',
          title: 'New Book Title',
          crawlId: 'test-crawl-id-2',
          createdAt: now
        }
      ];

      await repository.updateBooks(updates as any[]);

      const records = await db.select().from(book);
      expect(records).toHaveLength(2);

      const updated1 = records.find(r => r.url === 'https://example.com/update-1');
      expect(updated1!.title).toBe('Updated Title');

      const updated2 = records.find(r => r.url === 'https://example.com/update-2');
      expect(updated2!.title).toBe('New Book Title');
    });
  });
});
