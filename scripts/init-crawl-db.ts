#!/usr/bin/env tsx

import { initDatabase, getCrawlDbInstance } from "../db/index";
import { crawl as crawlTable } from "../db/schema-crawl";

async function main() {
  console.log("🔄 Initializing crawl database...");
  
  try {
    // Initialize only the crawl database in production mode
    const { crawl } = await initDatabase("prod");
    
    console.log("✅ Crawl database initialized successfully");
    console.log("📁 Database file: data/crawl.db");
    
    // Get the raw database instance to create tables if they don't exist
    const dbInstance = getCrawlDbInstance();
    if (dbInstance) {
      // Create tables if they don't exist (same as in initCrawlTestDatabase)
      dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS crawls (
          id TEXT PRIMARY KEY NOT NULL,
          url TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'pending' NOT NULL,
          type TEXT DEFAULT 'torrents-page' NOT NULL,
          code_page TEXT,
          html_body TEXT,
          created_at TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS crawl_history (
          id TEXT PRIMARY KEY NOT NULL,
          forum_id INTEGER NOT NULL,
          pages_crawled INTEGER DEFAULT 0,
          torrents_found INTEGER DEFAULT 0,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          status TEXT DEFAULT 'running',
          created_at TEXT NOT NULL
        );
      `);
      console.log("📊 Crawl database tables created/verified");
    }
    
    // Test the connection using Drizzle ORM syntax
    const testResult = await crawl.select().from(crawlTable).limit(1);
    console.log(`📊 Database test query successful. Found ${testResult.length} rows in crawls table.`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to initialize crawl database:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
