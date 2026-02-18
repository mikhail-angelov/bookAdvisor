import * as cheerio from 'cheerio';
import { NewBook } from '../db/schema';

/**
 * Parser interface for different torrent forum page types
 */
export interface TorrentListParser {
  /**
   * Parse torrents from a forum page HTML
   * @param html Raw HTML content of the forum page
   * @param forumId The forum ID being crawled
   * @returns Array of partial Book records
   */
  parse(html: string, forumId: number): Partial<NewBook>[];
}

/**
 * Parser interface for torrent topic pages
 */
export interface TorrentDetailsParser {
  /**
   * Parse torrent details from a topic page HTML
   * @param html Raw HTML content of the topic page
   * @param topicId The topic ID being parsed (optional)
   * @returns Partial Book record with detailed metadata
   */
  parse(html: string, topicId?: string): Partial<NewBook>;
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
  parse(html: string, forumId: number): Partial<NewBook>[] {
    const $ = cheerio.load(html);
    const books: Partial<NewBook>[] = [];
    const RUTRACKER_BASE_URL = 'https://rutracker.org/forum';

    const selectorPatterns = [
      'table.vf-table tbody tr.hl-tr',
      'table.vf-tor tbody tr',
      'tr.hl-tr[data-topic_id]',
      'tr[id^="tr-"]',
      'table.forumline tbody tr',
    ];

    let rows: cheerio.Cheerio<any> | null = null;
    for (const selector of selectorPatterns) {
      const testRows = $(selector);
      if (testRows.length > 0) {
        rows = testRows;
        break;
      }
    }

    if (!rows || rows.length === 0) return books;

    rows.each((_, row) => {
      try {
        const $row = $(row);
        if ($row.find('th').length > 0) return;
        
        let topicId = $row.attr('data-topic_id');
        if (!topicId) {
          const $link = $row.find('a[href*="viewtopic.php?t="]');
          const href = $link.attr('href');
          const topicIdMatch = href?.match(/t=(\d+)/);
          topicId = topicIdMatch?.[1];
        }
        
        if (!topicId) return;
        
        let $link = $row.find('a.torTopic, a.tt-text, a[id^="tt-"]');
        const title = $link.text().trim() || $link.attr('title') || '';
        if (!title) return;
        
        let $seedSpan = $row.find('span.seedmed');
        let $leechSpan = $row.find('span.leechmed');
        let seeds = parseNumber($seedSpan.find('b').first().text());
        let leechers = parseNumber($leechSpan.find('b').first().text());
        if (seeds === 0) seeds = parseNumber($seedSpan.text());
        if (leechers === 0) leechers = parseNumber($leechSpan.text());
        
        const $sizeLink = $row.find('a.dl-stub, a.f-dl');
        let size = $sizeLink.text().trim().replace(/\u00a0/g, ' ') || '0 B';
        
        const authorName = $row.find('a.topicAuthor').text().replace(/\s+/g, ' ').trim() || 'Unknown';
        
        const repliesCol = $row.find('td.vf-col-replies');
        const commentsCount = parseNumber(repliesCol.find('span[title="Ответов"]').text());
        const downloads = parseNumber(repliesCol.find('p.med b').text());
        
        const lastPostCol = $row.find('td.vf-col-last-post');
        const lastCommentDate = lastPostCol.find('p').first().text().trim();
        
        books.push({
          url: `${RUTRACKER_BASE_URL}/viewtopic.php?t=${topicId}`,
          title,
          externalId: parseInt(topicId, 10),
          size,
          seeds,
          leechers,
          downloads,
          commentsCount,
          lastCommentDate,
          authorName,
        });
      } catch (err) {
        console.error('Error parsing row:', err);
      }
    });

    return books;
  }
}

/**
 * Rutracker-specific parser for torrent topic pages
 */
export class RutrackerDetailsParser implements TorrentDetailsParser {
  parse(html: string, topicId?: string): Partial<NewBook> {
    const $ = cheerio.load(html);
    const url = topicId ? `https://rutracker.org/forum/viewtopic.php?t=${topicId}` : '';
    const topicTitle = $('#topic-title').text().trim() || $('.maintitle a').text().trim();
    
    const breadcrumbSelectors = ['.nav.t-breadcrumb-top a', '.t-breadcrumb-top a', '.nav a'];
    let breadcrumbs = null;
    for (const selector of breadcrumbSelectors) {
      const $crumbs = $(selector);
      if ($crumbs.length >= 2) {
        breadcrumbs = $crumbs;
        break;
      }
    }
    
    let category = 'Российская фантастика';
    if (breadcrumbs && breadcrumbs.length > 0) {
      category = breadcrumbs.eq(-1).text().trim();
    }
    
    const seeders = $('.seeders').length > 0 ? parseNumber($('.seeders').text().trim()) : 0;
    
    const sizeText = $('.attach_link.guest li').filter((_, el) => 
      $(el).text().includes('GB') || $(el).text().includes('MB')
    ).text().trim();
    const sizeMatch = sizeText.match(/\d+\.?\d*\s*[GMK]?B/)?.[0] || '';
    const size = sizeMatch.replace(/\s/g, ' ').trim();
    
    const postBody = $('.post_body').first();
    const structuredData = this.extractStructuredData(postBody, $);
    
    const authorName = $('.poster_info .nick').first().text().trim() || 
                      $('.nick.nick-author').first().text().trim();
    const authorPostsText = $('.poster_info .posts').first().text().trim() || $('.posts').first().text().trim();
    const authorPosts = parseNumber(authorPostsText);
    
    return {
      url,
      category,
      seeds: seeders,
      size,
      authorName: structuredData.authorFirstName && structuredData.authorLastName 
        ? `${structuredData.authorFirstName} ${structuredData.authorLastName}`.trim()
        : authorName,
      authorPosts,
      topicTitle,
      year: structuredData.year,
      authorFirstName: structuredData.authorFirstName,
      authorLastName: structuredData.authorLastName,
      performer: structuredData.performer,
      series: structuredData.series,
      bookNumber: structuredData.bookNumber,
      genre: structuredData.genre,
      editionType: structuredData.editionType,
      audioCodec: structuredData.audioCodec,
      bitrate: structuredData.bitrate,
      duration: structuredData.duration,
    };
  }
  
  private extractStructuredData(postBody: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
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
    
    postBody.find('.post-b').each((_, el) => {
      const $label = $(el);
      const labelText = $label.text().trim();
      let value = '';
      let nextNode = $label[0].nextSibling;
      while (nextNode && (nextNode.nodeType !== 1 || (nextNode as any).tagName !== 'br')) {
        if (nextNode.nodeType === 3) value += (nextNode as any).data;
        nextNode = nextNode.nextSibling;
      }
      value = value.replace(/^:\s*/, '').trim();
      
      if (labelText.includes('Год выпуска') || labelText.includes('Year')) {
        const yearMatch = value.match(/\d{4}/);
        if (yearMatch) result.year = parseInt(yearMatch[0], 10);
      } else if (labelText.includes('Фамилия автора')) result.authorLastName = value;
      else if (labelText.includes('Имя автора')) result.authorFirstName = value;
      else if (labelText.includes('Исполнитель')) result.performer = value;
      else if (labelText.includes('Цикл/серия')) result.series = value;
      else if (labelText.includes('Номер книги')) result.bookNumber = value;
      else if (labelText.includes('Жанр')) result.genre = value;
      else if (labelText.includes('Тип издания')) result.editionType = value;
      else if (labelText.includes('Аудиокодек')) result.audioCodec = value;
      else if (labelText.includes('Битрейт')) result.bitrate = value;
      else if (labelText.includes('Время звучания')) result.duration = value;
    });
    
    return result;
  }
}