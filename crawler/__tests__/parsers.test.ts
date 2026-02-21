import { RutrackerParser, RutrackerDetailsParser } from '../parsers';
import { fixture as forumHtml } from './fixtures/torrents-page';
import { fixture as detailsHtml } from './fixtures/torrent-details';
import { fixture as detailsHtml2 } from './fixtures/torrent-details2';
import { fixture as detailsHtml3 } from './fixtures/torrent-details3';
import { fixture as detailsHtml4 } from './fixtures/torrent-details4';
import { fixture as detailsHtml5 } from './fixtures/torrent-details5';

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
    expect(book.authors).toBe(' Чащин Валерий');
    expect(book.authorName).toBe('Чащин Валерий');
    expect(book.genre).toBe('Боевое фэнтези');
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

  it('should parse book details with multiple authors (Strugatsky)', () => {
    const topicId = '4622152';
    const book = parser.parse(detailsHtml2, topicId);

    expect(book.url).toBe('https://rutracker.org/forum/viewtopic.php?t=4622152');
    expect(book.topicTitle).toContain('Стругацкие');
    expect(book.topicTitle).toContain('Хищные вещи века');
    expect(book.category).toBe('[Аудио] Российская фантастика, фэнтези, мистика, ужасы, фанфики');
    expect(book.authors).toContain('Аркадий');
    expect(book.authors).toContain('Борис');
    expect(book.authors).toContain('Стругацкие');
    expect(book.performer).toBe('Герасимов Вячеслав');
    expect(book.genre).toBe('Фантастика');
  });

  it('should parse book details with multiple authors and performers (Karelin, Sorochinskaya)', () => {
    const topicId = '6242565';
    const book = parser.parse(detailsHtml3, topicId);

    expect(book.url).toBe('https://rutracker.org/forum/viewtopic.php?t=6242565');
    expect(book.topicTitle).toContain('Карелин Сергей');
    expect(book.topicTitle).toContain('Сорочинская София');
    expect(book.topicTitle).toContain('Спасти Эсквиллан');
    expect(book.category).toBe('[Аудио] Российская фантастика, фэнтези, мистика, ужасы, фанфики');
    expect(book.authors).toContain('Карелин Сергей');
    expect(book.authors).toContain('Сорочинская София');
    expect(book.performer).toContain('Григорий Метелица');
    expect(book.performer).toContain('Наталья Беляева');
    expect(book.genre).toContain('боевое фэнтези');
    expect(book.genre).toContain('попаданцы');
    expect(book.year).toBe(2021);
    expect(book.audioCodec).toBe('MP3');
    expect(book.bitrate).toBe('128 kbps');
    expect(book.duration).toBe('9:03:34');
    expect(book.description).toContain('Как бы вы отреагировали');
  });

  it('should parse book details with single author label (Strugatsky, Vitorgan)', () => {
    const topicId = '1027848';
    const book = parser.parse(detailsHtml4, topicId);

    expect(book.url).toBe('https://rutracker.org/forum/viewtopic.php?t=1027848');
    expect(book.topicTitle).toContain('Стругацкие');
    expect(book.topicTitle).toContain('Стажеры');
    expect(book.category).toBe('[Аудио] Российская фантастика, фэнтези, мистика, ужасы, фанфики');
    expect(book.authors).toContain('Стругацкие');
    expect(book.authors).toContain('Аркадий');
    expect(book.authors).toContain('Борис');
    expect(book.performer).toBe('Эммануил Виторган');
    expect(book.genre).toBe('Фантастика');
    expect(book.year).toBe(2006);
    expect(book.audioCodec).toBe('MP3');
    expect(book.bitrate).toBe('192 kbps');
    // Duration is in Russian format: "8 часов 28 минут."
    expect(book.duration).toContain('8');
    expect(book.duration).toContain('часов');
    expect(book.description).toContain('Стажёры');
  });

  it('should parse book details with separate author fields (Krasnitsky, Pronin)', () => {
    const topicId = '5788892';
    const book = parser.parse(detailsHtml5, topicId);

    expect(book.url).toBe('https://rutracker.org/forum/viewtopic.php?t=5788892');
    expect(book.topicTitle).toContain('Красницкий');
    expect(book.topicTitle).toContain('Отрок');
    expect(book.topicTitle).toContain('Ближний круг');
    expect(book.category).toBe('[Аудио] Российская фантастика, фэнтези, мистика, ужасы, фанфики');
    expect(book.authors).toContain('Красницкий');
    expect(book.authors).toContain('Евгений');
    expect(book.performer).toBe('Игорь Пронин');
    expect(book.genre).toContain('Боевая фантастика');
    expect(book.genre).toContain('Историческая фантастика');
    expect(book.genre).toContain('Попаданцы');
    expect(book.year).toBe(2019);
    expect(book.audioCodec).toBe('MP3');
    expect(book.bitrate).toBe('112 kbps');
    expect(book.duration).toBe('14:12:38');
    expect(book.series).toBe('Отрок');
    expect(book.bookNumber).toBe('4');
    expect(book.description).toContain('ближний круг');
  });
});
