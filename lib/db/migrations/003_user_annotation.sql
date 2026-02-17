-- Migration 003: Create user_annotation table
-- Stores user annotations/ratings for torrents

CREATE TABLE IF NOT EXISTS user_annotation (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  torrent_id TEXT,
  rating INTEGER,
  annotation TEXT,
  read_status TEXT DEFAULT 'unread',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (torrent_id) REFERENCES torrents(topic_id)
);

CREATE INDEX IF NOT EXISTS idx_annotation_user ON user_annotation(user_id);
CREATE INDEX IF NOT EXISTS idx_annotation_torrent ON user_annotation(torrent_id);
CREATE INDEX IF NOT EXISTS idx_annotation_status ON user_annotation(read_status);
