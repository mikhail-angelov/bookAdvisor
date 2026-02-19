import { RutrackerParser, RutrackerDetailsParser } from '../parsers';
import { fixture as forumHtml } from './fixtures/torrents-page';
import { fixture as detailsHtml } from './fixtures/torrent-details';

describe('RutrackerParser', () => {
  const parser = new RutrackerParser();

  it('should parse torrent list from forum page', () => {
    const forumId = 2387;
    const books = parser.parse(forumHtml, forumId);

    expect(books.length).toBeGreaterThan(0);
    
    // Check for a specific book from the fixture (e.g., topic 6737707)
    const book = books.find(b => b.externalId === 6737707);
    expect(book).toBeDefined();
    expect(book?.title).toContain('Чащин Валерий - Мастер 1-10');
    expect(book?.authorName).toContain('vugarmugar11');
    expect(book?.size).toBe('2.99 GB');
    expect(book?.seeds).toBe(1);
    expect(book?.leechers).toBe(2);
    expect(book?.url).toBe('https://rutracker.org/forum/viewtopic.php?t=6737707');
  });

  it('should parse seeds and leechers correctly', () => {
    const forumId = 2387;
    const books = parser.parse(forumHtml, forumId);
    
    // topic 6815544 has many seeds
    const popularBook = books.find(b => b.externalId === 6815544);
    expect(popularBook?.seeds).toBe(401);
    expect(popularBook?.leechers).toBe(23);
  });
});

describe('RutrackerDetailsParser', () => {
  const parser = new RutrackerDetailsParser();

  it('should parse book details from topic page', () => {
    const topicId = '6737707';
    const book = parser.parse(detailsHtml, topicId);

    expect(book.url).toBe('https://rutracker.org/forum/viewtopic.php?t=6737707');
    expect(book.topicTitle).toContain('Чащин Валерий - Мастер 1-10');
    expect(book.category).toBe('[Аудио] Российская фантастика, фэнтези, мистика, ужасы, фанфики');
    expect(book.authorFirstName).toBe('Валерий');
    expect(book.authorLastName).toBe('Чащин');
    expect(book.authorName).toBe('Валерий Чащин');
    expect(book.year).toBe(2025);
    expect(book.size).toBe('2.99 GB');
    expect(book.performer).toBe('CHUGA');
    expect(book.audioCodec).toBe('MP3');
    expect(book.bitrate).toBe('88 kbps');
    expect(book.description).toContain('Он здесь чужой');
    expect(book.imageUrl).toBe('https://i125.fastpic.org/big/2025/0828/53/595d9c7866a0da2cc445a823b3984453.jpeg');
  });

  it('should handle missing topicId gracefully', () => {
    const book = parser.parse(detailsHtml);
    expect(book.url).toBe('');
    expect(book.topicTitle).toBeDefined();
  });
});
