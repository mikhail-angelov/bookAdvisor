import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Crawl table - raw crawled pages
 */
export const crawl = sqliteTable("crawls", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull().default("torrents-page"),
  codePage: text("code_page"),
  htmlBody: text("html_body"),
  createdAt: text("created_at").notNull(),
});

/**
 * Crawl history table - tracks crawling operations
 */
export const crawlHistory = sqliteTable("crawl_history", {
  id: text("id").primaryKey(),
  forumId: integer("forum_id").notNull(),
  pagesCrawled: integer("pages_crawled").default(0),
  torrentsFound: integer("torrents_found").default(0),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").default("running"),
  createdAt: text("created_at").notNull(),
});

// Type exports for TypeScript
export type Crawl = typeof crawl.$inferSelect;
export type NewCrawl = typeof crawl.$inferInsert;
export type CrawlHistory = typeof crawlHistory.$inferSelect;
export type NewCrawlHistory = typeof crawlHistory.$inferInsert;
