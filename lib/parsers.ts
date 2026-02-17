import * as cheerio from 'cheerio';

/**
 * Shared torrent data interface
 */
export interface TorrentData {
  topicId: string;
  url: string;
  title: string;
  forumId: number;
  size: string;
  seeds: number;
  leechers: number;
  downloads: number;
  commentsCount: number;
  lastCommentDate: string;
  author: string;
  createdAt: string;
}

/**
 * Parser interface for different torrent forum page types
 * This allows for easy extensibility to support different torrent sites
 */
export interface TorrentListParser {
  /**
   * Parse torrents from a forum page HTML
   * @param html Raw HTML content of the forum page
   * @param forumId The forum ID being crawled
   * @returns Array of parsed torrent data
   */
  parse(html: string, forumId: number): TorrentData[];
}

/**
 * Helper function to parse a number from a string
 */
function parseNumber(numStr: string): number {
  const cleaned = numStr.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Rutracker-specific parser for torrent list pages
 */
export class RutrackerParser implements TorrentListParser {
  parse(html: string, forumId: number): TorrentData[] {
    const $ = cheerio.load(html);
    const torrents: TorrentData[] = [];
    const RUTRACKER_BASE_URL = 'https://rutracker.org/forum';

    // Define selector patterns for Rutracker - actual structure from page:
    // <table class="vf-table vf-tor forumline forum">
    // <tr id="tr-6768110" class="hl-tr" data-topic_id="6768110">
    const selectorPatterns = [
      'table.vf-table tbody tr.hl-tr',           // Rutracker vf-table with hl-tr class
      'table.vf-tor tbody tr',                  // Alternative vf-tor table
      'tr.hl-tr[data-topic_id]',                // Rows with data-topic_id attribute
      'tr[id^="tr-"]',                          // Rows with tr- prefix id
      'table.forumline tbody tr',               // forumline table
      '.forum__table.torrents tbody tr',        // Legacy/backup
    ];

    let rows: cheerio.Cheerio<any> | null = null;
    let usedSelector = '';

    // Try each selector pattern until we find rows
    for (const selector of selectorPatterns) {
      const testRows = $(selector);
      if (testRows.length > 0) {
        rows = testRows;
        usedSelector = selector;
        console.log(`[PARSER] Using selector: "${selector}" found ${rows.length} rows`);
        break;
      }
    }

    // If still no rows, log the HTML structure for debugging
    if (!rows || rows.length === 0) {
      console.log('[PARSER] No rows found with any selector. Logging page structure:');
      console.log('[PARSER] Tables found:', $('table').length);
      console.log('[PARSER] Classes on page:', $('body').attr('class'));
      console.log('[PARSER] First 500 chars of HTML:', html.substring(0, 500));
      return torrents;
    }

    rows.each((_, row) => {
      try {
        const $row = $(row);

        // Skip header rows
        if ($row.find('th').length > 0) return;
        
        // Get topic ID from data-topic_id attribute OR from link href
        let topicId = $row.attr('data-topic_id');
        if (!topicId) {
          // Fallback: get from link href
          const $link = $row.find('a[href*="viewtopic.php?t="]');
          const href = $link.attr('href');
          const topicIdMatch = href?.match(/t=(\d+)/);
          topicId = topicIdMatch?.[1];
        }
        
        if (!topicId) return;
        
        // Get title - Rutracker uses class="torTopic" or "tt-text"
        let $link = $row.find('a.torTopic, a.tt-text, a[id^="tt-"]');
        const title = $link.text().trim() || $link.attr('title') || '';
        
        // Skip empty titles
        if (!title) return;
        
        // Get seeds and leechers - be specific about the selector to avoid combining text
        let $seedSpan = $row.find('span.seedmed');
        let $leechSpan = $row.find('span.leechmed');
        let seeds = parseNumber($seedSpan.find('b').first().text());
        let leechers = parseNumber($leechSpan.find('b').first().text());
        
        // Fallback: if no b tag, try the span text directly
        if (seeds === 0) seeds = parseNumber($seedSpan.text());
        if (leechers === 0) leechers = parseNumber($leechSpan.text());
        
        // Get size from the download link (contains file size)
        const $sizeLink = $row.find('a.dl-stub, a.f-dl');
        let size = $sizeLink.text().trim() || '0 B';
        
        // Get author from topicAuthor class
        const author = $row.find('a.topicAuthor').text().trim() || 'Unknown';
        
        // Get comments count, downloads count, and last comment date
        const repliesCol = $row.find('td.vf-col-replies');
        const commentsCount = parseNumber(repliesCol.find('span[title="Ответов"]').text());
        const downloads = parseNumber(repliesCol.find('p.med b').text());
        
        // Get last post info (column 5)
        const lastPostCol = $row.find('td.vf-col-last-post');
        const lastPostText = lastPostCol.text().trim();
        const lastCommentDate = lastPostCol.find('p').first().text().trim();
        
        // Only add if we have a valid topic ID and title
        if (topicId && title) {
          torrents.push({
            topicId,
            url: `${RUTRACKER_BASE_URL}/viewtopic.php?t=${topicId}`,
            title,
            forumId,
            size,
            seeds,
            leechers,
            downloads,
            commentsCount,
            lastCommentDate,
            author,
            createdAt: lastPostText,
          });
        }
      } catch (err) {
        console.error('Error parsing row:', err);
      }
    });

    console.log(`[PARSER] Total torrents parsed: ${torrents.length}`);
    return torrents;
  }
}

/**
 * Factory to get the appropriate parser for a given forum type
 */
export class ParserFactory {
  private static parsers: Map<string, TorrentListParser> = new Map();
  
  /**
   * Register a parser for a specific forum/site type
   */
  static registerParser(name: string, parser: TorrentListParser): void {
    this.parsers.set(name, parser);
  }
  
  /**
   * Get a parser by name
   */
  static getParser(name: string): TorrentListParser {
    const parser = this.parsers.get(name);
    if (!parser) {
      throw new Error(`Parser '${name}' not found. Available parsers: ${Array.from(this.parsers.keys()).join(', ')}`);
    }
    return parser;
  }
  
  /**
   * Get the default Rutracker parser
   */
  static getDefaultParser(): TorrentListParser {
    return new RutrackerParser();
  }
}

// Register the default Rutracker parser
ParserFactory.registerParser('rutracker', new RutrackerParser());
