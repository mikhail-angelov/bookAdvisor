import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

// Import schemas
import * as crawlSchema from "./schema-crawl";
import * as appSchema from "./schema-app";

export type DbType = Database.Database;

// ================== CRAWL DATABASE ==================

// Crawl database instance - Drizzle ORM wrapper
let crawlDb: ReturnType<typeof drizzle> | null = null;
// Raw better-sqlite3 instance for crawl
let crawlDbInstance: DbType | null = null;

// ================== PROD DATABASE ==================

// Prod database instance - Drizzle ORM wrapper
let appDb: ReturnType<typeof drizzle> | null = null;
// Raw better-sqlite3 instance for prod
let appDbInstance: DbType | null = null;

// Current environment
let currentEnv: "prod" | "test" | null = null;

// Promise for asynchronous initialization
let crawlInitializationPromise: Promise<ReturnType<typeof drizzle>> | null = null;
let appInitializationPromise: Promise<ReturnType<typeof drizzle>> | null = null;

/**
 * Initialize both databases with environment parameter
 * @param env - 'prod' for file-based SQLite, 'test' for in-memory database
 */
export async function initDatabase(
  env: "prod" | "test",
): Promise<{ crawl: ReturnType<typeof drizzle>; prod: ReturnType<typeof drizzle> }> {
  if (appDb && crawlDb && currentEnv === env) {
    return { crawl: crawlDb, prod: appDb };
  }

  // Close existing connections if switching environments
  if (crawlDbInstance || appDbInstance) {
    closeDatabase();
  }

  if (env === "prod") {
    await Promise.all([initCrawlProdDatabase(), initProdDatabase()]);
  } else {
    await Promise.all([initCrawlTestDatabase(), initTestDatabase()]);
  }

  currentEnv = env;
  return { crawl: crawlDb!, prod: appDb! };
}

/**
 * Initialize crawl production database (file-based SQLite using better-sqlite3)
 */
async function initCrawlProdDatabase(): Promise<void> {
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "crawl.db");

  crawlDbInstance = new Database(dbPath);
  crawlDb = drizzle(crawlDbInstance, { schema: crawlSchema });

  console.log("Crawl database initialized at:", dbPath);
}

/**
 * Initialize crawl test database (in-memory using better-sqlite3)
 */
async function initCrawlTestDatabase(): Promise<void> {
  crawlDbInstance = new Database(":memory:");
  crawlDb = drizzle(crawlDbInstance, { schema: crawlSchema });
  migrate(crawlDb, { migrationsFolder: "./db/migrations" });

  console.log("Crawl test database initialized (in-memory)");
}

/**
 * Initialize production database (file-based SQLite using better-sqlite3)
 */
async function initProdDatabase(): Promise<void> {
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "prod.db");

  appDbInstance = new Database(dbPath);
  appDb = drizzle(appDbInstance, { schema: appSchema });

  console.log("Production database initialized at:", dbPath);
}

/**
 * Initialize test database (in-memory using better-sqlite3)
 */
async function initTestDatabase(): Promise<void> {
  // Use in-memory database for tests
  appDbInstance = new Database(":memory:");
  appDb = drizzle(appDbInstance, { schema: appSchema });
  migrate(appDb, { migrationsFolder: "./db/migrations" });

  console.log("Production test database initialized (in-memory)");
}

// ================== PUBLIC GETTERS ==================

/**
 * Get the crawl Drizzle ORM database instance
 */
export function getCrawlDb(): ReturnType<typeof drizzle> | null {
  if (!crawlDb) {
    console.warn("⚠️  Crawl database not initialized. Call initDatabase() first.");
  }
  return crawlDb;
}

/**
 * Get the prod Drizzle ORM database instance
 */
export function getProdDb(): ReturnType<typeof drizzle> | null {
  if (!appDb) {
    console.warn("⚠️  Prod database not initialized. Call initDatabase() first.");
  }
  return appDb;
}

/**
 * Get the crawl Drizzle ORM database instance asynchronously, ensuring initialization.
 * This is the preferred method for crawler operations.
 */
export async function getCrawlDbAsync(): Promise<ReturnType<typeof drizzle>> {
  if (crawlDb) {
    return crawlDb;
  }
  // If initialization is already in progress, return the existing promise
  if (crawlInitializationPromise) {
    return await crawlInitializationPromise;
  }
  // Determine default environment
  const defaultEnv = process.env.NODE_ENV === "test" ? "test" : "prod";
  // Create initialization promise
  crawlInitializationPromise = (async () => {
    if (defaultEnv === "prod") {
      await initCrawlProdDatabase();
    } else {
      await initCrawlTestDatabase();
    }
    return crawlDb!;
  })();
  try {
    const result = await crawlInitializationPromise;
    return result;
  } catch (error) {
    // If initialization fails, reset the promise so future calls can retry
    crawlInitializationPromise = null;
    throw error;
  }
}

/**
 * Get the app Drizzle ORM database instance asynchronously, ensuring initialization.
 * This is the preferred method for API routes.
 */
export async function getAppDbAsync(): Promise<ReturnType<typeof drizzle>> {
  if (appDb) {
    return appDb;
  }
  // If initialization is already in progress, return the existing promise
  if (appInitializationPromise) {
    return await appInitializationPromise;
  }
  // Determine default environment
  const defaultEnv = process.env.NODE_ENV === "test" ? "test" : "prod";
  // Create initialization promise
  appInitializationPromise = (async () => {
    if (defaultEnv === "prod") {
      await initProdDatabase();
    } else {
      await initTestDatabase();
    }
    return appDb!;
  })();
  try {
    const result = await appInitializationPromise;
    return result;
  } catch (error) {
    // If initialization fails, reset the promise so future calls can retry
    appInitializationPromise = null;
    throw error;
  }
}

/**
 * Get the crawl raw better-sqlite3 database instance
 */
export function getCrawlDbInstance(): DbType | null {
  return crawlDbInstance;
}

/**
 * Get the prod raw better-sqlite3 database instance
 */
export function getProdDbInstance(): DbType | null {
  return appDbInstance;
}

/**
 * Close all database connections
 */
export function closeDatabase(): void {
  if (crawlDbInstance) {
    crawlDbInstance.close();
    crawlDbInstance = null;
  }
  crawlDb = null;
  crawlInitializationPromise = null;

  if (appDbInstance) {
    appDbInstance.close();
    appDbInstance = null;
  }
  appDb = null;
  appInitializationPromise = null;

  currentEnv = null;
}

// ================== SCHEMA EXPORTS ==================

// Re-export crawl schema and types
export const { crawl, crawlHistory } = crawlSchema;
export type {
  Crawl,
  NewCrawl,
  CrawlHistory,
  NewCrawlHistory,
} from "./schema-crawl";

// Re-export prod schema and types
export const { user, book, userAnnotation } = appSchema;
export type {
  User,
  NewUser,
  Book,
  NewBook,
  UserAnnotation,
  NewUserAnnotation,
} from "./schema-app";
