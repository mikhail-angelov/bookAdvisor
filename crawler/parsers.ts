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
      authorName: structuredData.authors
        ? `${structuredData.authors}`.trim()
        : authorName,
      authorPosts,
      topicTitle,
      year: structuredData.year,
      authors: structuredData.authors,
      performer: structuredData.performer,
      series: structuredData.series,
      bookNumber: structuredData.bookNumber,
      genre: structuredData.genre,
      editionType: structuredData.editionType,
      audioCodec: structuredData.audioCodec,
      bitrate: structuredData.bitrate,
      duration: structuredData.duration,
      description: structuredData.description,
      imageUrl: structuredData.imageUrl,
    };
  }
  
  private extractStructuredData(postBody: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
    const result = {
      year: null as number | null,
      authors: '',
      performer: '',
      series: '',
      bookNumber: '',
      genre: '',
      editionType: '',
      audioCodec: '',
      bitrate: '',
      duration: '',
      description: '',
      imageUrl: '',
    };
    
    // Extract image URL from postImg elements
    const $img = postBody.find('.postImg');
    if ($img.length > 0) {
      result.imageUrl = $img.attr('title') || '';
    }
    
    // First, try to extract authors from styled spans (e.g., "Аркадий и Борис Стругацкие")
    // This format appears in some posts where authors are displayed as colored text
    if (!result.authors) {
      const authorSpan = postBody.find('span.post-b span.p-color').first();
      if (authorSpan.length > 0) {
        const authorText = authorSpan.text().trim();
        // Check if this looks like an author name (contains common author patterns)
        if (authorText && !authorText.includes('Год') && !authorText.includes('Исполнитель') && 
            !authorText.includes('Жанр') && !authorText.includes('Цикл')) {
          result.authors = authorText;
        }
      }
    }
    
    // Handle multiple label formats:
    // 1. <span class="post-b">Label</span>: Value
    // 2. <span class="post-b">Label</span>: <span class="post-b">Value</span>
    // 3. <span class="post-b">Label</span>: <span class="p-color">Value</span>
    // 4. <span class="p-color"><span class="post-b">Label</span></span>: Value
    postBody.find('.post-b').each((_, el) => {
      const $label = $(el);
      const isNestedInPColor = $label.parent().hasClass('p-color');
      
      // Get the label text
      const labelText = $label.text().trim();
      let value = '';
      
      // If nested in p-color, we need to look at the parent's next sibling
      if (isNestedInPColor) {
        const $parentPColor = $label.parent();
        const $nextSibling = $parentPColor.next();
        if ($nextSibling.length > 0) {
          // Check if next sibling is a text node or a span
          const nextNodeType = ($nextSibling[0] as unknown as Node).nodeType;
          if (nextNodeType === 3) {
            // Text node - just get text and clean up
            value = $nextSibling.text().replace(/^:\s*/, '').trim();
          } else if (nextNodeType === 1) {
            // Element node - check if it's a p-color span with the value
            if ($nextSibling.hasClass('p-color')) {
              value = $nextSibling.text().trim();
            } else {
              value = $nextSibling.text().replace(/^:\s*/, '').trim();
            }
          }
        }
      } else {
        // Check if the next sibling is a span with post-b class (nested case like "Исполнитель: Герасимов")
        const $nextSpan = $label.next('span.post-b');
        if ($nextSpan.length > 0) {
          value = $nextSpan.text().trim();
        } else {
          // Get text from text nodes after the label (format: "Label: Value")
          // This handles both plain text values, spans with p-color class, and links
          let nextNode = $label[0].nextSibling;
          let foundValue = false;
          while (nextNode) {
            // Stop at <br> or <hr> tags or any label span
            if (nextNode.nodeType === 1) {
              const tagName = (nextNode as any).tagName?.toUpperCase();
              // Stop at line breaks and label spans
              if (tagName === 'BR' || tagName === 'HR' || tagName === 'SPAN') {
                const $nextEl = $(nextNode);
                // Stop at post-b labels (but continue if it's a value span)
                if ($nextEl.hasClass('post-b') || $nextEl.hasClass('p-color')) {
                  break;
                }
              }
            }
            if (nextNode.nodeType === 3) {
              // Text node - accumulate text, then remove the ": " prefix
              value += (nextNode as any).data;
            } else if (nextNode.nodeType === 1) {
              const tagName = (nextNode as any).tagName?.toUpperCase();
              if (tagName === 'SPAN') {
                const $nextEl = $(nextNode);
                // Check if this is a p-color or post-b span containing the value
                if ($nextEl.hasClass('p-color') || $nextEl.hasClass('post-b')) {
                  value = $nextEl.text().trim();
                  foundValue = true;
                  break;
                }
              } else if (tagName === 'A') {
                // Handle links (e.g., performer name wrapped in <a> tag)
                value = $(nextNode).text().trim();
                foundValue = true;
                break;
              }
            }
            nextNode = nextNode.nextSibling;
          }
          if (!foundValue) {
            value = value.replace(/^:\s*/, '').trim();
          }
        }
      }
      
      if (labelText.includes('Год выпуска') || labelText.includes('Year')) {
        const yearMatch = value.match(/\d{4}/);
        if (yearMatch) result.year = parseInt(yearMatch[0], 10);
      } else if (labelText.includes('Фамилия автора')) result.authors = result.authors + ' ' +value;
      else if (labelText.includes('Имя автора')) result.authors = result.authors + ' ' +value;
      else if (labelText.includes('Авторы') || labelText === 'Автор') result.authors = value;
      else if (labelText.includes('Исполнител')) {
        // Handle comma-separated performers like "Григорий Метелица, Наталья Беляева"
        // Matches both "Исполнитель" (singular) and "Исполнители" (plural)
        result.performer = value.split(',').map(p => p.trim()).join(', ');
      }
      else if (labelText.includes('Цикл/серия')) result.series = value;
      else if (labelText.includes('Номер книги')) result.bookNumber = value;
      else if (labelText.includes('Жанр')) {
        // Handle comma-separated genres like "боевое фэнтези, попаданцы"
        result.genre = value.split(',').map(g => g.trim()).join(', ');
      }
      else if (labelText.includes('Тип издания')) result.editionType = value;
      else if (labelText.includes('Аудио кодек') || labelText.includes('Аудиокодек')) result.audioCodec = value;
      else if (labelText.includes('Битрейт')) result.bitrate = value;
      else if (labelText.includes('Время звучания')) result.duration = value;
      else if (labelText.includes('Описание')) {
        // Description might be multi-line, collect all text until next .post-b or end
        let desc = value;
        let next = $label[0].nextSibling;
        while (next) {
          if (next.nodeType === 1 && $(next).hasClass('post-b')) break;
          if (next.nodeType === 3) desc += (next as any).data;
          next = next.nextSibling;
        }
        result.description = desc.trim();
      }
    });
    
    // If performer still wasn't found, try extracting from p-color spans after labels
    if (!result.performer) {
      postBody.find('span.p-color span.post-b').each((_, el) => {
        const text = $(el).text().trim();
        if (text && !text.includes('Год') && !text.includes('Исполнитель') && 
            !text.includes('Жанр') && !text.includes('Цикл') && !text.includes('Аудио') &&
            !text.includes('Номер') && !text.includes('Тип') && !text.includes('Описание') &&
            !text.includes('Фамилия') && !text.includes('Имя')) {
          // This might be a performer or other value
          if (!result.performer && text.length > 2 && !text.includes('века')) {
            result.performer = text;
          }
        }
      });
    }
    
    return result;
  }
}
