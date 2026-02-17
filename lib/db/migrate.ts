import * as fs from 'fs';
import * as path from 'path';
import { getDbInstance } from './index';

/**
 * Run all pending database migrations
 */
export async function runMigrations(): Promise<void> {
  const db = getDbInstance();
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Ensure schema_migrations table exists (needed for in-memory test database)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(process.cwd(), 'lib/db/migrations');
  
  // Get list of migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const migrationName = file;
    
    // Check if migration already applied
    const alreadyApplied = isMigrationApplied(db, migrationName);
    
    if (alreadyApplied) {
      console.log(`[MIGRATION] Skipping ${migrationName} (already applied)`);
      continue;
    }

    console.log(`[MIGRATION] Applying ${migrationName}...`);
    
    // Read and execute migration
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    
    // Record migration
    recordMigration(db, migrationName);
    console.log(`[MIGRATION] Applied ${migrationName}`);
  }
  
  console.log('[MIGRATION] All migrations complete');
}

/**
 * Check if migration was already applied
 */
function isMigrationApplied(db: ReturnType<typeof getDbInstance>, name: string): boolean {
  if (!db) return false;

  const stmt = db.prepare('SELECT COUNT(*) as count FROM schema_migrations WHERE name = ?');
  const row = stmt.get(name) as { count: number };
  return row.count > 0;
}

/**
 * Record a migration as applied
 */
function recordMigration(db: ReturnType<typeof getDbInstance>, name: string): void {
  if (!db) return;

  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  stmt.run(name, now);
}
