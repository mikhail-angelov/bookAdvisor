import { defineConfig } from "drizzle-kit";

/**
 * Drizzle configuration for bookAdvisor project
 * 
 * This project uses two databases:
 * - crawl.db: Crawl-related tables (crawls, crawl_history)
 * - prod.db: Production tables (users, books, user_annotations)
 * 
 * Run migrations with:
 * - npx drizzle-kit migrate (for prod.db using default config)
 * - npx drizzle-kit migrate:crawl (for crawl.db)
 */

export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema-prod.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: "data/prod.db",
  },
});
