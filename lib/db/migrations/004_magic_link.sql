-- Migration 004: Create magic_link table
-- Stores magic link tokens for authentication

CREATE TABLE IF NOT EXISTS magic_link (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link(token);
