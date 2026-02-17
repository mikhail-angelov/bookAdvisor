import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import * as path from "path";
import * as schema from "./schema";
import {
  torrents,
  torrentDetails,
  crawlHistory,
  users,
  crawl,
  userAnnotation,
} from "./schema";

export type DbType = Database.Database;

// Database instance - Drizzle ORM wrapper
let db: ReturnType<typeof drizzle> | null = null;
// Raw better-sqlite3 instance
let dbInstance: DbType | null = null;
let currentEnv: "prod" | "test" | null = null;
// Promise for asynchronous initialization
let initializationPromise: Promise<ReturnType<typeof drizzle>> | null = null;

/**
 * Initialize database with environment parameter
 * @param env - 'prod' for file-based SQLite, 'test' for in-memory database
 */
export async function initDatabase(
  env: "prod" | "test",
): Promise<ReturnType<typeof drizzle>> {
  if (db && currentEnv === env) {
    return db;
  }

  // Close existing connection if switching environments
  if (dbInstance) {
    closeDatabase();
  }

  if (env === "prod") {
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
  const dbPath = path.join(process.cwd(), "prod.db");

  dbInstance = new Database(dbPath);

  // Enable WAL mode for better performance
  dbInstance.pragma("journal_mode = WAL");

  db = drizzle(dbInstance);

  console.log("Production database initialized at:", dbPath);
}

/**
 * Initialize test database (in-memory using better-sqlite3)
 */
async function initTestDatabase(): Promise<void> {
  // Use in-memory database for tests
  dbInstance = new Database(":memory:");
  db = drizzle(dbInstance, { schema });
  migrate(db, { migrationsFolder: "./db/migrations" });

  console.log("Test database initialized (in-memory)");
}

/**
 * Get the Drizzle ORM database instance
 */
export function getDb(): ReturnType<typeof drizzle> | null {
  if (!db) {
    console.warn("⚠️  Database not initialized. Call initDatabase() first.");
    console.warn(
      "   This typically happens when API routes run without proper setup.",
    );
    console.warn(
      "   Consider using getDbAsync() which ensures initialization.",
    );
  }
  return db;
}

/**
 * Get the Drizzle ORM database instance asynchronously, ensuring initialization.
 * This is the preferred method for API routes.
 */
export async function getDbAsync(): Promise<ReturnType<typeof drizzle>> {
  if (db) {
    return db;
  }
  // If initialization is already in progress, return the existing promise
  if (initializationPromise) {
    return await initializationPromise;
  }
  // Determine default environment
  const defaultEnv = process.env.NODE_ENV === 'test' ? 'test' : 'prod';
  // Create initialization promise
  initializationPromise = initDatabase(defaultEnv);
  try {
    const result = await initializationPromise;
    return result;
  } catch (error) {
    // If initialization fails, reset the promise so future calls can retry
    initializationPromise = null;
    throw error;
  }
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
  initializationPromise = null;
}

// Re-export schema and types
export { torrents, torrentDetails, crawlHistory, users, crawl, userAnnotation };
export type {
  Torrent,
  NewTorrent,
  TorrentDetail,
  NewTorrentDetail,
  CrawlHistory,
  NewCrawlHistory,
  User,
  NewUser,
  CrawlRecord,
  NewCrawlRecord,
  UserAnnotation,
  NewUserAnnotation,
} from "./schema";
