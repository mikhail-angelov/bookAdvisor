/**
 * Database schema - re-exports from split schema files for backward compatibility
 * 
 * Crawl-related tables: schema-crawl.ts -> crawl.db
 * Prod-related tables: schema-app.ts -> prod.db
 */

// Re-export crawl schemas
export { crawl, crawlHistory } from "./schema-crawl";
export type {
  Crawl,
  NewCrawl,
  CrawlHistory,
  NewCrawlHistory,
} from "./schema-crawl";

// Re-export prod schemas
export { user, book, userAnnotation } from "./schema-app";
export type {
  User,
  NewUser,
  Book,
  NewBook,
  UserAnnotation,
  NewUserAnnotation,
} from "./schema-app";
