-- Migration 001: Create crawl table
-- Stores raw HTML content from crawled pages

CREATE TABLE IF NOT EXISTS crawl (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  time TEXT NOT NULL,
  code_page TEXT,
  html_body TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crawl_url ON crawl(url);
CREATE INDEX IF NOT EXISTS idx_crawl_time ON crawl(time);
