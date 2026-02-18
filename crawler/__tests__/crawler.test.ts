/**
 * Integration test for the crawler workflow with mocked HTTP
 */

import { main } from '../main';
import { CrawlConfig } from '../types';
import { initDatabase, closeDatabase } from '../../db/index';
import { fixture as forumFixture } from './fixtures/torrents-page';
import { fixture as detailsFixture } from './fixtures/torrent-details';

// Mock the fetcher module
jest.mock('../fetcher', () => ({
  fetchUrl: jest.fn().mockImplementation((url: string) => {
    console.log(`Mock fetchUrl called for: ${url}`);
    
    if (url.includes('viewforum.php')) {
      return Promise.resolve({
        url,
        html: forumFixture,
        status: 200,
        contentType: 'text/html; charset=windows-1251',
        encoding: 'windows-1251'
      });
    }
    
    if (url.includes('viewtopic.php')) {
      return Promise.resolve({
        url,
        html: detailsFixture,
        status: 200,
        contentType: 'text/html; charset=windows-1251',
        encoding: 'windows-1251'
      });
    }
    
    return Promise.resolve({
      url,
      html: '',
      status: 404,
      error: 'Not found'
    });
  }),
  
  fetchUrls: jest.fn().mockResolvedValue([])
}));

describe('Crawler Integration', () => {
  jest.setTimeout(30000);
  beforeAll(async () => {
    // Initialize in-memory test database
    await initDatabase('test');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(async () => {
    // Clear database before each test
    const db = await import('../../db/index').then(m => m.getDbAsync());
    if (db) {
      await db.delete(require('../../db/index').crawl);
      await db.delete(require('../../db/index').crawlHistory);
    }
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  it('should complete crawl workflow with mocked HTTP', async () => {
    const config: CrawlConfig = {
      forumId: 2387,
      pages: 1,
      concurrentRequests: 1,
      retryAttempts: 0,
      retryDelayMs: 0
    };

    // Run the crawler
    await main(config);

    // Verify database state
    const db = await import('../../db/index').then(m => m.getDbAsync());
    const crawlRecords = await db!.select().from(require('../../db/index').crawl);
    const historyRecords = await db!.select().from(require('../../db/index').crawlHistory);

    // Should have:
    // 1 forum page crawl record (completed)
    // N torrent detail crawl records (completed) - based on number of torrents in fixture
    // 1 crawl history record (completed)
    
    expect(crawlRecords.length).toBeGreaterThan(0);
    expect(historyRecords.length).toBe(1);
    
    // All crawl records should be completed (or error)
    const completedOrError = crawlRecords.filter(r => 
      r.status === 'completed' || r.status === 'error'
    );
    expect(completedOrError.length).toBe(crawlRecords.length);
    
    // History should be marked as completed
    expect(historyRecords[0].status).toBe('completed');
    expect(historyRecords[0].pagesCrawled).toBe(1);
    expect(historyRecords[0].torrentsFound).toBeGreaterThan(0);
    
    // Verify fetcher was called for forum page
    const { fetchUrl } = require('../fetcher');
    expect(fetchUrl).toHaveBeenCalledWith(
      expect.stringContaining('viewforum.php?f=2387'),
      expect.any(Object)
    );
    
    // Verify fetcher was called for torrent detail pages
    const detailCalls = (fetchUrl.mock.calls as any[]).filter(([url]) => 
      url.includes('viewtopic.php')
    );
    expect(detailCalls.length).toBeGreaterThan(0);
  });

  it('should handle fetch errors gracefully', async () => {
    // Mock fetchUrl to fail for forum page
    const { fetchUrl } = require('../fetcher');
    fetchUrl.mockImplementationOnce(() => Promise.resolve({
      url: 'https://rutracker.org/forum/viewforum.php?f=2387',
      html: '',
      status: 0,
      error: 'Network error'
    }));

    const config: CrawlConfig = {
      forumId: 2387,
      pages: 1,
      concurrentRequests: 1,
      retryAttempts: 0,
      retryDelayMs: 0
    };

    // Run the crawler - should not throw
    await main(config);

    // Verify crawl record marked as error
    const db = await import('../../db/index').then(m => m.getDbAsync());
    const crawlRecords = await db!.select().from(require('../../db/index').crawl);
    
    expect(crawlRecords.length).toBe(1);
    expect(crawlRecords[0].status).toBe('error');
    expect(crawlRecords[0].htmlBody).toBe('Network error');
  });

  it('should process multiple forum pages', async () => {
    const config: CrawlConfig = {
      forumId: 2387,
      pages: 2,
      concurrentRequests: 2,
      retryAttempts: 0,
      retryDelayMs: 0
    };

    await main(config);

    // Verify fetcher was called for both pages
    const { fetchUrl } = require('../fetcher');
    const forumPageCalls = (fetchUrl.mock.calls as any[]).filter(([url]) => 
      url.includes('viewforum.php')
    );
    
    expect(forumPageCalls.length).toBe(2);
    
    // First page: no start parameter
    expect(forumPageCalls[0][0]).toBe('https://rutracker.org/forum/viewforum.php?f=2387');
    // Second page: start=50
    expect(forumPageCalls[1][0]).toBe('https://rutracker.org/forum/viewforum.php?f=2387&start=50');
  });
});