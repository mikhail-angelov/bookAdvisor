import { getDb, getDbAsync, torrents, torrentDetails, crawlHistory, users, crawl, userAnnotation } from "./index";
import { eq, like, desc, asc, sql, and, or } from "drizzle-orm";
import type {
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

/**
 * Get all torrents with optional search
 */
export async function getAllTorrents(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  forumId?: number;
  sort?: string;
  order?: string;
}): Promise<Torrent[]> {
  const db = await getDbAsync();
  if (!db) {
    console.error("[QUERIES] Database not initialized in getAllTorrents!");
    return [];
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const sort = options?.sort || "lastUpdated";
  const order = options?.order || "desc";

  // Build conditions
  const conditions = [];
  if (options?.search) {
    conditions.push(like(torrents.title, `%${options.search}%`));
  }
  if (options?.forumId) {
    conditions.push(eq(torrents.forumId, options.forumId));
  }

  // Determine sort column
  const sortColumn =
    {
      title: torrents.title,
      seeds: torrents.seeds,
      downloads: torrents.downloads,
      size: torrents.size,
      lastUpdated: torrents.lastUpdated,
    }[sort] || torrents.lastUpdated;

  const orderFn = order.toLowerCase() === "asc" ? asc : desc;

  const result = await db
    .select()
    .from(torrents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  return result;
}

/**
 * Get torrent by topic ID
 */
export async function getTorrentByTopicId(
  topicId: string,
): Promise<Torrent | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(torrents)
    .where(eq(torrents.topicId, topicId))
    .limit(1);

  return result[0];
}

/**
 * Get torrent by ID
 */
export async function getTorrentById(id: string): Promise<Torrent | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(torrents)
    .where(eq(torrents.id, id))
    .limit(1);

  return result[0];
}

/**
 * Check if torrent exists by topic ID
 */
export async function torrentExistsByTopicId(
  topicId: string,
): Promise<boolean> {
  const db = await getDbAsync();
  if (!db) return false;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(torrents)
    .where(eq(torrents.topicId, topicId));

  return (result[0]?.count ?? 0) > 0;
}

/**
 * Insert a new torrent
 */
export async function insertTorrent(torrent: NewTorrent): Promise<void> {
  const db = await getDbAsync();
  if (!db) return;

  await db
    .insert(torrents)
    .values({
      id: torrent.id,
      topicId: torrent.topicId,
      url: torrent.url,
      title: torrent.title,
      forumId: torrent.forumId,
      size: torrent.size ?? null,
      seeds: torrent.seeds ?? 0,
      leechers: torrent.leechers ?? 0,
      downloads: torrent.downloads ?? 0,
      commentsCount: torrent.commentsCount ?? 0,
      lastCommentDate: torrent.lastCommentDate ?? null,
      author: torrent.author ?? null,
      createdAt: torrent.createdAt ?? null,
      lastUpdated: torrent.lastUpdated ?? null,
      status: torrent.status ?? "active",
    })
    .onConflictDoUpdate({
      target: torrents.topicId,
      set: {
        url: torrent.url,
        title: torrent.title,
        forumId: torrent.forumId,
        size: torrent.size ?? null,
        seeds: torrent.seeds ?? 0,
        leechers: torrent.leechers ?? 0,
        downloads: torrent.downloads ?? 0,
        commentsCount: torrent.commentsCount ?? 0,
        lastCommentDate: torrent.lastCommentDate ?? null,
        author: torrent.author ?? null,
        createdAt: torrent.createdAt ?? null,
        lastUpdated: torrent.lastUpdated ?? null,
        status: torrent.status ?? "active",
      },
    });
}

/**
 * Bulk upsert torrents
 */
export async function bulkUpsertTorrents(
  torrentsList: NewTorrent[],
): Promise<{ inserted: number; updated: number }> {
  const db = await getDbAsync();
  if (!db) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (const torrent of torrentsList) {
    const exists = await torrentExistsByTopicId(torrent.topicId);

    if (exists) {
      // Update existing record
      await db
        .update(torrents)
        .set({
          url: torrent.url,
          title: torrent.title,
          forumId: torrent.forumId,
          size: torrent.size ?? null,
          seeds: torrent.seeds ?? 0,
          leechers: torrent.leechers ?? 0,
          downloads: torrent.downloads ?? 0,
          commentsCount: torrent.commentsCount ?? 0,
          lastCommentDate: torrent.lastCommentDate ?? null,
          author: torrent.author ?? null,
          createdAt: torrent.createdAt ?? null,
          lastUpdated: torrent.lastUpdated ?? null,
          status: torrent.status ?? "active",
        })
        .where(eq(torrents.topicId, torrent.topicId));
      updated++;
    } else {
      // Insert new record
      await db.insert(torrents).values({
        id: torrent.id,
        topicId: torrent.topicId,
        url: torrent.url,
        title: torrent.title,
        forumId: torrent.forumId,
        size: torrent.size ?? null,
        seeds: torrent.seeds ?? 0,
        leechers: torrent.leechers ?? 0,
        downloads: torrent.downloads ?? 0,
        commentsCount: torrent.commentsCount ?? 0,
        lastCommentDate: torrent.lastCommentDate ?? null,
        author: torrent.author ?? null,
        createdAt: torrent.createdAt ?? null,
        lastUpdated: torrent.lastUpdated ?? null,
        status: torrent.status ?? "active",
      });
      inserted++;
    }
  }

  return { inserted, updated };
}

/**
 * Bulk check which topic IDs exist
 */
export async function bulkCheckTopicIds(
  topicIds: string[],
): Promise<Set<string>> {
  const db = await getDbAsync();
  if (!db || topicIds.length === 0) return new Set();

  const result = await db
    .select({ topicId: torrents.topicId })
    .from(torrents)
    .where(sql`${torrents.topicId} IN (${topicIds.map((id) => id)})`);

  return new Set(result.map((r) => r.topicId));
}

/**
 * Count total torrents with optional filters
 */
export async function countTorrents(options?: {
  search?: string;
  forumId?: number;
}): Promise<number> {
  const db = await getDbAsync();
  if (!db) {
    console.error("[QUERIES] Database not initialized in countTorrents!");
    return 0;
  }

  const conditions = [];
  if (options?.search) {
    conditions.push(like(torrents.title, `%${options.search}%`));
  }
  if (options?.forumId) {
    conditions.push(eq(torrents.forumId, options.forumId));
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(torrents)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0]?.count ?? 0;
}

// ============ Torrent Details ============

/**
 * Get torrent details by torrent ID
 */
export async function getTorrentDetailsByTorrentId(
  torrentId: string,
): Promise<TorrentDetail | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(torrentDetails)
    .where(eq(torrentDetails.torrentId, torrentId))
    .limit(1);

  return result[0];
}

/**
 * Insert or update torrent details
 */
export async function insertTorrentDetails(
  details: NewTorrentDetail,
): Promise<void> {
  const db = await getDbAsync();
  if (!db) return;

  await db
    .insert(torrentDetails)
    .values({
      id: details.id,
      torrentId: details.torrentId,
      url: details.url,
      description: details.description ?? null,
      category: details.category ?? null,
      forumName: details.forumName ?? null,
      registeredUntil: details.registeredUntil ?? null,
      seeders: details.seeders ?? 0,
      lastChecked: details.lastChecked ?? null,
      magnetLink: details.magnetLink ?? null,
      torrentFile: details.torrentFile ?? null,
      size: details.size ?? null,
      createdAt: details.createdAt ?? null,
      authorName: details.authorName ?? null,
      authorPosts: details.authorPosts ?? null,
      topicTitle: details.topicTitle ?? null,
      year: details.year ?? null,
      authorFirstName: details.authorFirstName ?? null,
      authorLastName: details.authorLastName ?? null,
      performer: details.performer ?? null,
      series: details.series ?? null,
      bookNumber: details.bookNumber ?? null,
      genre: details.genre ?? null,
      editionType: details.editionType ?? null,
      audioCodec: details.audioCodec ?? null,
      bitrate: details.bitrate ?? null,
      duration: details.duration ?? null,
    })
    .onConflictDoUpdate({
      target: torrentDetails.id,
      set: {
        url: details.url,
        description: details.description ?? null,
        category: details.category ?? null,
        forumName: details.forumName ?? null,
        registeredUntil: details.registeredUntil ?? null,
        seeders: details.seeders ?? 0,
        lastChecked: details.lastChecked ?? null,
        magnetLink: details.magnetLink ?? null,
        torrentFile: details.torrentFile ?? null,
        size: details.size ?? null,
        createdAt: details.createdAt ?? null,
        authorName: details.authorName ?? null,
        authorPosts: details.authorPosts ?? null,
        topicTitle: details.topicTitle ?? null,
        year: details.year ?? null,
        authorFirstName: details.authorFirstName ?? null,
        authorLastName: details.authorLastName ?? null,
        performer: details.performer ?? null,
        series: details.series ?? null,
        bookNumber: details.bookNumber ?? null,
        genre: details.genre ?? null,
        editionType: details.editionType ?? null,
        audioCodec: details.audioCodec ?? null,
        bitrate: details.bitrate ?? null,
        duration: details.duration ?? null,
      },
    });
}

// ============ Crawl History ============

/**
 * Insert crawl history
 */
export async function insertCrawlHistory(
  history: NewCrawlHistory,
): Promise<void> {
  const db = await getDbAsync();
  if (!db) return;

  await db.insert(crawlHistory).values({
    id: history.id,
    forumId: history.forumId,
    pagesCrawled: history.pagesCrawled ?? 0,
    torrentsFound: history.torrentsFound ?? 0,
    startedAt: history.startedAt,
    completedAt: history.completedAt ?? null,
    status: history.status ?? "running",
    createdAt: history.createdAt,
  });
}

/**
 * Get all crawl history
 */
export async function getCrawlHistory(
  limit: number = 10,
): Promise<CrawlHistory[]> {
  const db = await getDbAsync();
  if (!db) {
    console.error("[QUERIES] Database not initialized in getCrawlHistory!");
    return [];
  }

  const result = await db
    .select()
    .from(crawlHistory)
    .orderBy(desc(crawlHistory.startedAt))
    .limit(limit);

  return result;
}

/**
 * Update crawl history
 */
export async function updateCrawlHistory(
  id: string,
  updates: Partial<NewCrawlHistory>,
): Promise<void> {
  const db = await getDbAsync();
  if (!db) return;

  const updateData: any = {};
  if (updates.pagesCrawled !== undefined)
    updateData.pagesCrawled = updates.pagesCrawled;
  if (updates.torrentsFound !== undefined)
    updateData.torrentsFound = updates.torrentsFound;
  if (updates.completedAt !== undefined)
    updateData.completedAt = updates.completedAt;
  if (updates.status !== undefined) updateData.status = updates.status;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(crawlHistory)
      .set(updateData)
      .where(eq(crawlHistory.id, id));
  }
}

// ============ Crawl Records ============



/**
 * Insert a crawl record
 */
export async function insertCrawlRecord(record: Omit<NewCrawlRecord, 'createdAt'>): Promise<void> {
  const db = await getDbAsync();
  if (!db) return;

  await db.insert(crawl).values({
    id: record.id,
    url: record.url,
    time: record.time,
    codePage: record.codePage ?? null,
    htmlBody: record.htmlBody ?? null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Get crawl record by URL
 */
export async function getCrawlRecordByUrl(
  url: string,
): Promise<CrawlRecord | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(crawl)
    .where(eq(crawl.url, url))
    .orderBy(desc(crawl.time))
    .limit(1);

  if (!result || result.length === 0) return undefined;
  return result[0];
}

/**
 * Get crawl records by forum ID
 */
export async function getCrawlRecordsByForumId(
  forumId: number,
): Promise<CrawlRecord[]> {
  const db = await getDbAsync();
  if (!db) return [];

  // URL pattern: https://rutracker.org/forum/viewforum.php?f={forumId}&start={page}
  const urlPattern = `viewforum.php?f=${forumId}`;
  
  const result = await db
    .select()
    .from(crawl)
    .where(like(crawl.url, `%${urlPattern}%`))
    .orderBy(desc(crawl.time));

  return result;
}

/**
 * Get crawl records for reparse - includes both forum pages for a given forum and all topic pages
 */
export async function getCrawlRecordsForReparse(
  forumId: number,
): Promise<CrawlRecord[]> {
  const db = await getDbAsync();
  if (!db) return [];

  // URL pattern for forum pages of this forum
  const forumUrlPattern = `viewforum.php?f=${forumId}`;
  // URL pattern for topic pages (any forum)
  const topicUrlPattern = `viewtopic.php`;
  
  const result = await db
    .select()
    .from(crawl)
    .where(or(
      like(crawl.url, `%${forumUrlPattern}%`),
      like(crawl.url, `%${topicUrlPattern}%`)
    ))
    .orderBy(desc(crawl.time));

  return result;
}

// ============ Users ============



/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!result || result.length === 0) return undefined;
  return result[0];
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!result || result.length === 0) return undefined;
  return result[0];
}

/**
 * Insert or get user (upsert)
 */
export async function upsertUser(user: Omit<NewUser, 'createdAt'>): Promise<User> {
  const db = await getDbAsync();
  if (!db) throw new Error("Database not initialized");

  const existing = await getUserByEmail(user.email || "");
  if (existing) return existing;

  const now = new Date().toISOString();

  await db.insert(users).values({
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    createdAt: now,
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    createdAt: now,
  };
}

// ============ User Annotations ============



/**
 * Get annotation by user and torrent
 */
export async function getAnnotationByUserAndTorrent(
  userId: string,
  torrentId: string,
): Promise<UserAnnotation | undefined> {
  const db = await getDbAsync();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userAnnotation)
    .where(and(eq(userAnnotation.userId, userId), eq(userAnnotation.torrentId, torrentId)))
    .limit(1);

  if (!result || result.length === 0) return undefined;
  return result[0];
}

/**
 * Get all annotations by user
 */
export async function getAnnotationsByUser(
  userId: string,
  limit: number = 100,
): Promise<UserAnnotation[]> {
  const db = await getDbAsync();
  if (!db) return [];

  const result = await db
    .select()
    .from(userAnnotation)
    .where(eq(userAnnotation.userId, userId))
    .orderBy(desc(userAnnotation.updatedAt))
    .limit(limit);

  return result;
}

/**
 * Insert or update annotation
 */
export async function upsertAnnotation(
  annotation: Omit<NewUserAnnotation, 'createdAt' | 'updatedAt'>,
): Promise<UserAnnotation> {
  const db = await getDbAsync();
  if (!db) throw new Error("Database not initialized");

  const now = new Date().toISOString();
  const existing = annotation.torrentId
    ? await getAnnotationByUserAndTorrent(
        annotation.userId,
        annotation.torrentId,
      )
    : undefined;

  if (existing) {
    // Update existing
    const updateData: Partial<UserAnnotation> = { updatedAt: now };
    if (annotation.rating !== undefined) updateData.rating = annotation.rating;
    if (annotation.annotation !== undefined)
      updateData.annotation = annotation.annotation;
    if (annotation.readStatus !== undefined)
      updateData.readStatus = annotation.readStatus;
    if (annotation.startedAt !== undefined)
      updateData.startedAt = annotation.startedAt;
    if (annotation.completedAt !== undefined)
      updateData.completedAt = annotation.completedAt;

    await db
      .update(userAnnotation)
      .set(updateData)
      .where(eq(userAnnotation.id, existing.id));

    return { ...existing, ...annotation, updatedAt: now };
  } else {
    // Insert new
    const insertData = {
      id: annotation.id,
      userId: annotation.userId,
      torrentId: annotation.torrentId ?? null,
      rating: annotation.rating ?? null,
      annotation: annotation.annotation ?? null,
      readStatus: annotation.readStatus ?? "unread",
      startedAt: annotation.startedAt ?? null,
      completedAt: annotation.completedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(userAnnotation).values(insertData);

    return insertData;
  }
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const db = await getDbAsync();
  if (!db) return;

  await db.delete(userAnnotation).where(eq(userAnnotation.id, id));
}
