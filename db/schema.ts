import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Torrents table - main torrent list data from forum pages
 */
export const torrents = sqliteTable('torrents', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull().unique(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  forumId: integer('forum_id').notNull(),
  size: text('size'),
  seeds: integer('seeds').default(0),
  leechers: integer('leechers').default(0),
  downloads: integer('downloads').default(0),
  commentsCount: integer('comments_count').default(0),
  lastCommentDate: text('last_comment_date'),
  author: text('author'),
  createdAt: text('created_at'),
  lastUpdated: text('last_updated'),
  status: text('status').default('active'),
});

/**
 * Torrent details table - detailed info from topic page
 */
export const torrentDetails = sqliteTable('torrent_details', {
  id: text('id').primaryKey(),
  torrentId: text('torrent_id').notNull().references(() => torrents.topicId),
  url: text('url').notNull(),
  description: text('description'),
  category: text('category'),
  forumName: text('forum_name'),
  registeredUntil: text('registered_until'),
  seeders: integer('seeders').default(0),
  lastChecked: text('last_checked'),
  magnetLink: text('magnet_link'),
  torrentFile: text('torrent_file'),
  size: text('size'),
  createdAt: text('created_at'),
  // Additional fields from HTML parsing
  authorName: text('author_name'),
  authorPosts: integer('author_posts'),
  topicTitle: text('topic_title'),
  year: integer('year'),
  authorFirstName: text('author_first_name'),
  authorLastName: text('author_last_name'),
  performer: text('performer'),
  series: text('series'),
  bookNumber: text('book_number'),
  genre: text('genre'),
  editionType: text('edition_type'),
  audioCodec: text('audio_codec'),
  bitrate: text('bitrate'),
  duration: text('duration'),
});

/**
 * Crawl history table - tracks crawling operations
 */
export const crawlHistory = sqliteTable('crawl_history', {
  id: text('id').primaryKey(),
  forumId: integer('forum_id').notNull(),
  pagesCrawled: integer('pages_crawled').default(0),
  torrentsFound: integer('torrents_found').default(0),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  status: text('status').default('running'),
  createdAt: text('created_at').notNull(),
});

/**
 * Users table
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  email: text('email'),
  createdAt: text('created_at').notNull(),
});

/**
 * Crawl table - raw crawled pages
 */
export const crawl = sqliteTable('crawl', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  time: text('time').notNull(),
  codePage: text('code_page'),
  htmlBody: text('html_body'),
  createdAt: text('created_at').notNull(),
});

/**
 * User annotations table
 */
export const userAnnotation = sqliteTable('user_annotation', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  torrentId: text('torrent_id'),
  rating: integer('rating'),
  annotation: text('annotation'),
  readStatus: text('read_status').default('unread'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
});

// Type exports for TypeScript
export type Torrent = typeof torrents.$inferSelect;
export type NewTorrent = typeof torrents.$inferInsert;
export type TorrentDetail = typeof torrentDetails.$inferSelect;
export type NewTorrentDetail = typeof torrentDetails.$inferInsert;
export type CrawlHistory = typeof crawlHistory.$inferSelect;
export type NewCrawlHistory = typeof crawlHistory.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CrawlRecord = typeof crawl.$inferSelect;
export type NewCrawlRecord = typeof crawl.$inferInsert;
export type UserAnnotation = typeof userAnnotation.$inferSelect;
export type NewUserAnnotation = typeof userAnnotation.$inferInsert;
