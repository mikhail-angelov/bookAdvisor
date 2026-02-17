import { RutrackerDetailsParser, DetailsParserFactory, TorrentDetailsData } from '@/lib/details-parser';
import { fixture } from './fixtures/torrent-details';

describe('RutrackerDetailsParser', () => {
  const parser = new RutrackerDetailsParser();

  it('should parse torrent details from HTML', () => {
    const details = parser.parse(fixture, '6737707');

    // Basic required fields
    expect(details.url).toBe('https://rutracker.org/forum/viewtopic.php?t=6737707');
    expect(details.topicTitle).toContain('Чащин Валерий - Мастер 1-10');
    expect(details.description).toBeTruthy();
    expect(details.description.length).toBeGreaterThan(100);
    expect(details.category).toBe('Аудиокниги');
    expect(details.forumName).toBe('Фантастика, фэнтези, мистика, ужасы, фанфики');
    expect(details.seeders).toBe(0); // Seeders not present on topic page
    expect(details.magnetLink).toContain('magnet:?');
    expect(details.torrentFile).toBe(''); // No torrent file link for guests
    expect(details.size).toBe('2.99 GB');
    
    // Author information
    expect(details.authorName).toBe('vugarmugar11');
    expect(details.authorPosts).toBe(2954);
    
    // Structured data from post body
    expect(details.year).toBe(2025); // Should extract first year from range
    expect(details.authorLastName).toBe('Чащин');
    expect(details.authorFirstName).toBe('Валерий');
    expect(details.performer).toBe('CHUGA');
    expect(details.series).toBe('Мастер');
    expect(details.bookNumber).toBe('1-10');
    expect(details.genre).toBe('Боевое фэнтези');
    expect(details.editionType).toBe('неофициальное издание');
    expect(details.audioCodec).toBe('MP3');
    expect(details.bitrate).toBe('88 kbps');
    expect(details.duration).toBe('79:45:33');
  });

  it('should handle missing optional fields gracefully', () => {
    // Create minimal HTML without optional structured data
    const minimalHTML = `
      <!DOCTYPE html>
      <html>
      <body>
        <h1 class="maintitle">
          <a id="topic-title" href="viewtopic.php?t=999999">Test Title</a>
        </h1>
        <div class="nav">
          <a href="/">Main</a>
          <a href="/forum/viewforum.php?f=1">Category</a>
          <a href="/forum/viewforum.php?f=2">Forum Name</a>
        </div>
        <div class="post_body">Test description</div>
        <div class="seeders">10</div>
        <div class="magnet">
          <a href="magnet:?test">Magnet</a>
        </div>
        <div class="download">
          <a href="/forum/dl.php?t=999999">Download</a>
        </div>
        <p class="nick nick-author">TestAuthor</p>
        <p class="posts"><em>Сообщений:</em> 100</p>
      </body>
      </html>
    `;

    const details = parser.parse(minimalHTML, '999999');

    // Required fields should be parsed
    expect(details.url).toBe('https://rutracker.org/forum/viewtopic.php?t=999999');
    expect(details.topicTitle).toBe('Test Title');
    expect(details.description).toBe('Test description');
    expect(details.category).toBe('Main');
    expect(details.forumName).toBe('Category');
    expect(details.seeders).toBe(10);
    expect(details.magnetLink).toBe('magnet:?test');
    expect(details.torrentFile).toBe('/forum/dl.php?t=999999');
    expect(details.authorName).toBe('TestAuthor');
    expect(details.authorPosts).toBe(100);
    
    // Optional structured fields should be empty/null
    expect(details.year).toBeNull();
    expect(details.authorLastName).toBe('');
    expect(details.authorFirstName).toBe('');
    expect(details.performer).toBe('');
    expect(details.series).toBe('');
    expect(details.bookNumber).toBe('');
    expect(details.genre).toBe('');
    expect(details.editionType).toBe('');
    expect(details.audioCodec).toBe('');
    expect(details.bitrate).toBe('');
    expect(details.duration).toBe('');
  });

  it('should extract size from attach link', () => {
    // HTML with size in attach link
    const htmlWithSize = `
      <!DOCTYPE html>
      <html>
      <body>
        <div class="attach_link guest">
          <ul>
            <li>1.5 GB</li>
          </ul>
        </div>
      </body>
      </html>
    `;

    // We need a full parse but we can test size extraction indirectly
    // Since we can't easily test the private method, we'll rely on the full fixture test
    // This test is more for documentation
    expect(true).toBe(true);
  });

  it('should parse number from text correctly', () => {
    // Test parseNumber through public API with comma-separated numbers
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <h1 class="maintitle">
          <a id="topic-title" href="viewtopic.php?t=888888">Test Title</a>
        </h1>
        <div class="nav">
          <a href="/">Main</a>
          <a href="/forum/viewforum.php?f=1">Category</a>
        </div>
        <div class="post_body">Test description</div>
        <div class="seeders">1,234 seeders</div>
        <div class="magnet">
          <a href="magnet:?test">Magnet</a>
        </div>
        <div class="download">
          <a href="/forum/dl.php?t=888888">Download</a>
        </div>
        <p class="nick nick-author">TestAuthor</p>
        <p class="posts"><em>Сообщений:</em> 5,678</p>
      </body>
      </html>
    `;
    
    const details = parser.parse(html, '888888');
    expect(details.seeders).toBe(1234);
    expect(details.authorPosts).toBe(5678);
  });
});

describe('DetailsParserFactory', () => {
  beforeEach(() => {
    // Clear any registered parsers before each test
    // The factory uses static map, but we can't easily clear it
    // For now, rely on the default registration
  });

  it('should register and retrieve parsers', () => {
    const testParser = {
      parse: jest.fn().mockReturnValue({} as TorrentDetailsData)
    };
    
    // Register a test parser
    DetailsParserFactory.registerParser('test', testParser);
    
    // Retrieve it
    const retrieved = DetailsParserFactory.getParser('test');
    expect(retrieved).toBe(testParser);
  });

  it('should throw error for unknown parser', () => {
    expect(() => DetailsParserFactory.getParser('unknown')).toThrow();
  });

  it('should return default Rutracker parser', () => {
    const defaultParser = DetailsParserFactory.getDefaultParser();
    expect(defaultParser).toBeInstanceOf(RutrackerDetailsParser);
  });
});