import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as path from 'path';
import { torrents, torrentDetails, crawlHistory } from './schema';
import { runMigrations } from './migrate';

export type DbType = Database.Database;

// Database instance - Drizzle ORM wrapper
let db: ReturnType<typeof drizzle> | null = null;
// Raw better-sqlite3 instance
let dbInstance: DbType | null = null;
let currentEnv: 'prod' | 'test' | null = null;

/**
 * Initialize database with environment parameter
 * @param env - 'prod' for file-based SQLite, 'test' for in-memory database
 */
export async function initDatabase(env: 'prod' | 'test'): Promise<ReturnType<typeof drizzle>> {
  if (db && currentEnv === env) {
    return db;
  }

  // Close existing connection if switching environments
  if (dbInstance) {
    closeDatabase();
  }

  if (env === 'prod') {
    await initProdDatabase();
  } else {
    await initTestDatabase();
  }

  currentEnv = env;
  return db!;
}

/**
 * Initialize production database (file-based SQLite using better-sqlite3)
 */
async function initProdDatabase(): Promise<void> {
  const dbPath = path.join(process.cwd(), 'prod.db');
  
  dbInstance = new Database(dbPath);
  
  // Enable WAL mode for better performance
  dbInstance.pragma('journal_mode = WAL');
  
  db = drizzle(dbInstance);
  
  // Run migrations for new tables
  await runMigrations();
  
  console.log('Production database initialized at:', dbPath);
}

/**
 * Initialize test database (in-memory using better-sqlite3)
 */
async function initTestDatabase(): Promise<void> {
  // Use in-memory database for tests
  dbInstance = new Database(':memory:');
  
  db = drizzle(dbInstance);
  
  // Run migrations to create all tables
  await runMigrations();
  
  console.log('Test database initialized (in-memory)');
}

/**
 * Get the Drizzle ORM database instance
 */
export function getDb(): ReturnType<typeof drizzle> | null {
  return db;
}

/**
 * Get the raw better-sqlite3 database instance
 */
export function getDbInstance(): DbType | null {
  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  db = null;
  currentEnv = null;
}

// Re-export schema and types
export { torrents, torrentDetails, crawlHistory };
export type { Torrent, NewTorrent, TorrentDetail, NewTorrentDetail, CrawlHistory, NewCrawlHistory } from './schema';
