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
 * Interface for parsed torrent details from topic pages
 * Maps to the torrent_details table schema
 */
export interface TorrentDetailsData {
  // Core fields from existing TorrentDetailsData in crawler.ts
  url: string;
  description: string;
  category: string;
  forumName: string;
  registeredUntil: string;
  seeders: number;
  magnetLink: string;
  torrentFile: string;
  
  // Additional fields from torrent_details table
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
  
  // Fields for internal use
  size?: string;
  author?: string;
}

/**
 * Parser interface for torrent topic pages
 */
export interface TorrentDetailsParser {
  /**
   * Parse torrent details from a topic page HTML
   * @param html Raw HTML content of the topic page
   * @param topicId The topic ID being parsed (optional, for validation)
   * @returns Parsed torrent details data
   */
  parse(html: string, topicId?: string): TorrentDetailsData;
}


/**
 * Rutracker-specific parser for torrent topic pages
 */
export class RutrackerDetailsParser implements TorrentDetailsParser {
  parse(html: string, topicId?: string): TorrentDetailsData {
    const $ = cheerio.load(html);
    
    // Extract basic information from the page structure
    const url = topicId ? `https://rutracker.org/forum/viewtopic.php?t=${topicId}` : '';
    
    // Get topic title from the main title link
    const topicTitle = $('#topic-title').text().trim() || $('.maintitle a').text().trim();
    
    // Get category and forum name from breadcrumb navigation
    const breadcrumbSelectors = [
      '.nav.t-breadcrumb-top a',
      '.t-breadcrumb-top a',
      '.nav a',
      'nav a'
    ];
    let breadcrumbs = null;
    for (const selector of breadcrumbSelectors) {
      const $crumbs = $(selector);
      if ($crumbs.length >= 2) {
        breadcrumbs = $crumbs;
        break;
      }
    }
    let category = '';
    let forumName = '';
    if (breadcrumbs) {
      const breadcrumbCount = breadcrumbs.length;
      if (breadcrumbCount >= 3) {
        category = breadcrumbs.eq(-3).text().trim();
      }
      if (breadcrumbCount >= 2) {
        forumName = breadcrumbs.eq(-2).text().trim();
      }
    }
    
    // Get description from the first post body
    const description = $('.post_body')
      .first()
      .text()
      .trim()
      .substring(0, 5000);
    
    // Get registered until (if available)
    const registeredUntil = $('.reg-details span').text().trim() || '';
    
    // Get seeders from torrent details (if available)
    const seeders = $('.seeders').length > 0 ? parseNumber($('.seeders').text().trim()) : 0;
    
    // Get magnet link
    const magnetLink = $('a.magnet-link').attr('href') || $('a[href^="magnet:?"]').attr('href') || '';
    
    // Get torrent file link
    const torrentFile = $('.download a').attr('href') || $('a[href*="dl.php"]').attr('href') || '';
    
    // Get size from download section (e.g., "2.99 GB")
    const sizeText = $('.attach_link.guest li').filter((_, el) => 
      $(el).text().includes('GB') || $(el).text().includes('MB')
    ).text().trim();
    const sizeMatch = sizeText.match(/\d+\.?\d*\s*[GMK]?B/)?.[0] || '';
    const size = sizeMatch.replace(/\s/g, ' ').trim(); // Normalize whitespace
    
    // Extract structured data from the first post body
    const postBody = $('.post_body').first();
    const structuredData = this.extractStructuredData(postBody, $);
    
    // Extract author information from poster info (first post only)
    const authorName = $('.poster_info .nick').first().text().trim() || 
                      $('.nick.nick-author').first().text().trim();
    const authorPostsText = $('.poster_info .posts').first().text().trim() || $('.posts').first().text().trim();
    const authorPosts = parseNumber(authorPostsText);
    
    // Extract author first and last name from structured data if not already set
    const authorFirstName = structuredData.authorFirstName || '';
    const authorLastName = structuredData.authorLastName || '';
    
    // Combine author name from structured data or poster info
    const author = authorFirstName && authorLastName 
      ? `${authorFirstName} ${authorLastName}`.trim()
      : authorName;
    
    return {
      url,
      description,
      category,
      forumName,
      registeredUntil,
      seeders,
      magnetLink,
      torrentFile,
      authorName,
      authorPosts,
      topicTitle,
      year: structuredData.year,
      authorFirstName,
      authorLastName,
      performer: structuredData.performer,
      series: structuredData.series,
      bookNumber: structuredData.bookNumber,
      genre: structuredData.genre,
      editionType: structuredData.editionType,
      audioCodec: structuredData.audioCodec,
      bitrate: structuredData.bitrate,
      duration: structuredData.duration,
      size,
      author,
    };
  }
  
  /**
   * Extract structured key-value pairs from post body
   * Example format: <span class="post-b">Год выпуска</span>: 2025-2026
   */
  private extractStructuredData(postBody: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): {
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
  } {
    const result = {
      year: null as number | null,
      authorFirstName: '',
      authorLastName: '',
      performer: '',
      series: '',
      bookNumber: '',
      genre: '',
      editionType: '',
      audioCodec: '',
      bitrate: '',
      duration: '',
    };
    
    // Find all bold labels (class "post-b") and their following text
    postBody.find('.post-b').each((_, el) => {
      const $label = $(el);
      const labelText = $label.text().trim();
      // Get the text after the label (up to next <br> or end)
      let value = '';
      let nextNode = $label[0].nextSibling;
      while (nextNode && (nextNode.nodeType !== 1 || (nextNode as any).tagName !== 'br')) {
        if (nextNode.nodeType === 3) { // Text node
          value += (nextNode as any).data;
        }
        nextNode = nextNode.nextSibling;
      }
      value = value.replace(/^:\s*/, '').trim();
      
      // Map Russian labels to fields
      if (labelText.includes('Год выпуска') || labelText.includes('Year')) {
        // Extract first year from range like "2025-2026"
        const yearMatch = value.match(/\d{4}/);
        if (yearMatch) {
          result.year = parseInt(yearMatch[0], 10);
        }
      } else if (labelText.includes('Фамилия автора') || labelText.includes('Author last name')) {
        result.authorLastName = value;
      } else if (labelText.includes('Имя автора') || labelText.includes('Author first name')) {
        result.authorFirstName = value;
      } else if (labelText.includes('Исполнитель') || labelText.includes('Performer')) {
        result.performer = value;
      } else if (labelText.includes('Цикл/серия') || labelText.includes('Series')) {
        result.series = value;
      } else if (labelText.includes('Номер книги') || labelText.includes('Book number')) {
        result.bookNumber = value;
      } else if (labelText.includes('Жанр') || labelText.includes('Genre')) {
        result.genre = value;
      } else if (labelText.includes('Тип издания') || labelText.includes('Edition type')) {
        result.editionType = value;
      } else if (labelText.includes('Аудиокодек') || labelText.includes('Audio codec')) {
        result.audioCodec = value;
      } else if (labelText.includes('Битрейт') || labelText.includes('Bitrate')) {
        result.bitrate = value;
      } else if (labelText.includes('Время звучания') || labelText.includes('Duration')) {
        result.duration = value;
      }
    });
    
    return result;
  }
}

/**
 * Factory to get the appropriate parser for a given forum type
 */
export class ParserFactory {
  private static parsers: Map<string, TorrentListParser|TorrentDetailsParser> = new Map();
  
  /**
   * Register a parser for a specific forum/site type
   */
  static registerParser(name: string, parser: TorrentListParser|TorrentDetailsParser): void {
    this.parsers.set(name, parser);
  }
  
  /**
   * Get a parser by name
   */
  static getParser(name: string): TorrentListParser|TorrentDetailsParser {
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
ParserFactory.registerParser('rutracker-deatils', new RutrackerDetailsParser());