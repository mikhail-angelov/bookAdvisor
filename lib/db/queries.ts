import { getDb, torrents, torrentDetails, crawlHistory } from './index';
import { eq, like, desc, asc, sql, and } from 'drizzle-orm';
import type { Torrent, NewTorrent, TorrentDetail, NewTorrentDetail, CrawlHistory, NewCrawlHistory } from './schema';

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
  const db = getDb();
  if (!db) {
    console.error('[QUERIES] Database not initialized in getAllTorrents!');
    return [];
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const sort = options?.sort || 'lastUpdated';
  const order = options?.order || 'desc';

  // Build conditions
  const conditions = [];
  if (options?.search) {
    conditions.push(like(torrents.title, `%${options.search}%`));
  }
  if (options?.forumId) {
    conditions.push(eq(torrents.forumId, options.forumId));
  }

  // Determine sort column
  const sortColumn = {
    'title': torrents.title,
    'seeds': torrents.seeds,
    'downloads': torrents.downloads,
    'size': torrents.size,
    'lastUpdated': torrents.lastUpdated,
  }[sort] || torrents.lastUpdated;

  const orderFn = order.toLowerCase() === 'asc' ? asc : desc;

  const result = await db.select()
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
export async function getTorrentByTopicId(topicId: string): Promise<Torrent | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(torrents)
    .where(eq(torrents.topicId, topicId))
    .limit(1);
  
  return result[0];
}

/**
 * Get torrent by ID
 */
export async function getTorrentById(id: string): Promise<Torrent | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(torrents)
    .where(eq(torrents.id, id))
    .limit(1);
  
  return result[0];
}

/**
 * Check if torrent exists by topic ID
 */
export async function torrentExistsByTopicId(topicId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const result = await db.select({ count: sql<number>`count(*)` })
    .from(torrents)
    .where(eq(torrents.topicId, topicId));
  
  return (result[0]?.count ?? 0) > 0;
}

/**
 * Insert a new torrent
 */
export async function insertTorrent(torrent: NewTorrent): Promise<void> {
  const db = getDb();
  if (!db) return;

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
    author: torrent.author ?? null,
    createdAt: torrent.createdAt ?? null,
    lastUpdated: torrent.lastUpdated ?? null,
    status: torrent.status ?? 'active',
  }).onConflictDoUpdate({
    target: torrents.topicId,
    set: {
      url: torrent.url,
      title: torrent.title,
      forumId: torrent.forumId,
      size: torrent.size ?? null,
      seeds: torrent.seeds ?? 0,
      leechers: torrent.leechers ?? 0,
      downloads: torrent.downloads ?? 0,
      author: torrent.author ?? null,
      createdAt: torrent.createdAt ?? null,
      lastUpdated: torrent.lastUpdated ?? null,
      status: torrent.status ?? 'active',
    }
  });
}

/**
 * Bulk upsert torrents
 */
export async function bulkUpsertTorrents(torrentsList: NewTorrent[]): Promise<{ inserted: number; updated: number }> {
  const db = getDb();
  if (!db) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (const torrent of torrentsList) {
    const exists = await torrentExistsByTopicId(torrent.topicId);
    
    if (exists) {
      // Update existing record
      await db.update(torrents)
        .set({
          url: torrent.url,
          title: torrent.title,
          forumId: torrent.forumId,
          size: torrent.size ?? null,
          seeds: torrent.seeds ?? 0,
          leechers: torrent.leechers ?? 0,
          downloads: torrent.downloads ?? 0,
          author: torrent.author ?? null,
          createdAt: torrent.createdAt ?? null,
          lastUpdated: torrent.lastUpdated ?? null,
          status: torrent.status ?? 'active',
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
        author: torrent.author ?? null,
        createdAt: torrent.createdAt ?? null,
        lastUpdated: torrent.lastUpdated ?? null,
        status: torrent.status ?? 'active',
      });
      inserted++;
    }
  }

  return { inserted, updated };
}

/**
 * Bulk check which topic IDs exist
 */
export async function bulkCheckTopicIds(topicIds: string[]): Promise<Set<string>> {
  const db = getDb();
  if (!db || topicIds.length === 0) return new Set();

  const result = await db.select({ topicId: torrents.topicId })
    .from(torrents)
    .where(sql`${torrents.topicId} IN (${topicIds.map(id => id)})`);

  return new Set(result.map(r => r.topicId));
}

/**
 * Count total torrents with optional filters
 */
export async function countTorrents(options?: { 
  search?: string;
  forumId?: number;
}): Promise<number> {
  const db = getDb();
  if (!db) {
    console.error('[QUERIES] Database not initialized in countTorrents!');
    return 0;
  }

  const conditions = [];
  if (options?.search) {
    conditions.push(like(torrents.title, `%${options.search}%`));
  }
  if (options?.forumId) {
    conditions.push(eq(torrents.forumId, options.forumId));
  }

  const result = await db.select({ count: sql<number>`count(*)` })
    .from(torrents)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0]?.count ?? 0;
}

// ============ Torrent Details ============

/**
 * Get torrent details by torrent ID
 */
export async function getTorrentDetailsByTorrentId(torrentId: string): Promise<TorrentDetail | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(torrentDetails)
    .where(eq(torrentDetails.torrentId, torrentId))
    .limit(1);
  
  return result[0];
}

/**
 * Insert or update torrent details
 */
export async function insertTorrentDetails(details: NewTorrentDetail): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db.insert(torrentDetails).values({
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
  }).onConflictDoUpdate({
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
    }
  });
}

// ============ Crawl History ============

/**
 * Insert crawl history
 */
export async function insertCrawlHistory(history: NewCrawlHistory): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db.insert(crawlHistory).values({
    id: history.id,
    forumId: history.forumId,
    pagesCrawled: history.pagesCrawled ?? 0,
    torrentsFound: history.torrentsFound ?? 0,
    startedAt: history.startedAt,
    completedAt: history.completedAt ?? null,
    status: history.status ?? 'running',
    createdAt: history.createdAt,
  });
}

/**
 * Get all crawl history
 */
export async function getCrawlHistory(limit: number = 10): Promise<CrawlHistory[]> {
  const db = getDb();
  if (!db) {
    console.error('[QUERIES] Database not initialized in getCrawlHistory!');
    return [];
  }

  const result = await db.select()
    .from(crawlHistory)
    .orderBy(desc(crawlHistory.startedAt))
    .limit(limit);

  return result;
}

/**
 * Update crawl history
 */
export async function updateCrawlHistory(id: string, updates: Partial<NewCrawlHistory>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const updateData: any = {};
  if (updates.pagesCrawled !== undefined) updateData.pagesCrawled = updates.pagesCrawled;
  if (updates.torrentsFound !== undefined) updateData.torrentsFound = updates.torrentsFound;
  if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt;
  if (updates.status !== undefined) updateData.status = updates.status;

  if (Object.keys(updateData).length > 0) {
    await db.update(crawlHistory)
      .set(updateData)
      .where(eq(crawlHistory.id, id));
  }
}

// ============ Crawl Records ============

export interface CrawlRecord {
  id: string;
  url: string;
  time: string;
  code_page: string | null;
  html_body: string | null;
  created_at: string;
}

export interface NewCrawlRecord {
  id: string;
  url: string;
  time: string;
  codePage?: string;
  htmlBody?: string;
}

/**
 * Insert a crawl record
 */
export async function insertCrawlRecord(record: NewCrawlRecord): Promise<void> {
  const db = getDb();
  if (!db) return;

  // Use raw SQL for crawl table since it's not in schema
  await db.run(sql`
    INSERT INTO crawl (id, url, time, code_page, html_body, created_at)
    VALUES (${record.id}, ${record.url}, ${record.time}, ${record.codePage ?? null}, ${record.htmlBody ?? null}, ${new Date().toISOString()})
  `);
}

/**
 * Get crawl record by URL
 */
export async function getCrawlRecordByUrl(url: string): Promise<CrawlRecord | undefined> {
  const db = getDb();
  if (!db) return undefined;

  // Use raw SQL for crawl table since it's not in schema
  const result = await db.select()
    .from(sql`crawl`)
    .where(sql`url = ${url}`)
    .orderBy(sql`time DESC`)
    .limit(1);
  
  if (!result || result.length === 0) return undefined;
  return result[0] as unknown as CrawlRecord;
}

// ============ Users ============

export interface User {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
}

export interface NewUser {
  id: string;
  username: string;
  email?: string;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  if (!db) return undefined;

  // Use raw SQL for users table since it's not in schema
  const result = await db.select()
    .from(sql`users`)
    .where(sql`id = ${id}`)
    .limit(1);
  
  if (!result || result.length === 0) return undefined;
  return result[0] as unknown as User;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = getDb();
  if (!db) return undefined;

  // Use raw SQL for users table since it's not in schema
  const result = await db.select()
    .from(sql`users`)
    .where(sql`email = ${email}`)
    .limit(1);
  
  if (!result || result.length === 0) return undefined;
  return result[0] as unknown as User;
}

/**
 * Insert or get user (upsert)
 */
export async function upsertUser(user: NewUser): Promise<User> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const existing = await getUserByEmail(user.email || '');
  if (existing) return existing;

  const now = new Date().toISOString();

  // Use raw SQL for users table since it's not in schema
  await db.run(sql`
    INSERT INTO users (id, username, email, created_at)
    VALUES (${user.id}, ${user.username}, ${user.email ?? null}, ${now})
  `);

  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    created_at: now,
  };
}

// ============ User Annotations ============

export interface UserAnnotation {
  id: string;
  user_id: string;
  torrent_id: string | null;
  rating: number | null;
  annotation: string | null;
  read_status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface NewUserAnnotation {
  id: string;
  userId: string;
  torrentId?: string;
  rating?: number;
  annotation?: string;
  readStatus?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Get annotation by user and torrent
 */
export async function getAnnotationByUserAndTorrent(userId: string, torrentId: string): Promise<UserAnnotation | undefined> {
  const db = getDb();
  if (!db) return undefined;

  // Use raw SQL for user_annotation table since it's not in schema
  const result = await db.select()
    .from(sql`user_annotation`)
    .where(sql`user_id = ${userId} AND torrent_id = ${torrentId}`)
    .limit(1);
  
  if (!result || result.length === 0) return undefined;
  return result[0] as unknown as UserAnnotation;
}

/**
 * Get all annotations by user
 */
export async function getAnnotationsByUser(userId: string, limit: number = 100): Promise<UserAnnotation[]> {
  const db = getDb();
  if (!db) return [];

  // Use raw SQL for user_annotation table since it's not in schema
  const result = await db.select()
    .from(sql`user_annotation`)
    .where(sql`user_id = ${userId}`)
    .orderBy(sql`updated_at DESC`)
    .limit(limit);
  
  return result as unknown as UserAnnotation[];
}

/**
 * Insert or update annotation
 */
export async function upsertAnnotation(annotation: NewUserAnnotation): Promise<UserAnnotation> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const now = new Date().toISOString();
  const existing = annotation.torrentId ? await getAnnotationByUserAndTorrent(annotation.userId, annotation.torrentId) : undefined;

  if (existing) {
    // Update existing
    const updateData: any = { updated_at: now };
    if (annotation.rating !== undefined) updateData.rating = annotation.rating;
    if (annotation.annotation !== undefined) updateData.annotation = annotation.annotation;
    if (annotation.readStatus !== undefined) updateData.read_status = annotation.readStatus;
    if (annotation.startedAt !== undefined) updateData.started_at = annotation.startedAt;
    if (annotation.completedAt !== undefined) updateData.completed_at = annotation.completedAt;

    // Build SET clause dynamically
    const sets = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updateData);
    await db.run(sql`UPDATE user_annotation SET ${sql.raw(sets)} WHERE id = ${existing.id}`);

    return { ...existing, ...annotation, updated_at: now };
  } else {
    // Insert new
    const insertData = {
      id: annotation.id,
      user_id: annotation.userId,
      torrent_id: annotation.torrentId ?? null,
      rating: annotation.rating ?? null,
      annotation: annotation.annotation ?? null,
      read_status: annotation.readStatus ?? 'unread',
      started_at: annotation.startedAt ?? null,
      completed_at: annotation.completedAt ?? null,
      created_at: now,
      updated_at: now,
    };

    // Use raw SQL for user_annotation table
    await db.run(sql`
      INSERT INTO user_annotation (id, user_id, torrent_id, rating, annotation, read_status, started_at, completed_at, created_at, updated_at)
      VALUES (${insertData.id}, ${insertData.user_id}, ${insertData.torrent_id}, ${insertData.rating}, ${insertData.annotation}, ${insertData.read_status}, ${insertData.started_at}, ${insertData.completed_at}, ${insertData.created_at}, ${insertData.updated_at})
    `);

    return insertData as unknown as UserAnnotation;
  }
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  // Use raw SQL for user_annotation table
  await db.run(sql`DELETE FROM user_annotation WHERE id = ${id}`);
}

// ============ Magic Links ============

export interface MagicLink {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface NewMagicLink {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
}

/**
 * Insert magic link
 */
export async function insertMagicLink(link: NewMagicLink): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date().toISOString();

  // Use raw SQL for magic_link table
  await db.run(sql`
    INSERT INTO magic_link (id, email, token, expires_at, created_at)
    VALUES (${link.id}, ${link.email}, ${link.token}, ${link.expiresAt}, ${now})
  `);
}

/**
 * Get valid magic link by token
 */
export async function getValidMagicLink(token: string): Promise<MagicLink | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const now = new Date().toISOString();

  // Use raw SQL for magic_link table
  const result = await db.select()
    .from(sql`magic_link`)
    .where(sql`token = ${token} AND expires_at > ${now} AND used_at IS NULL`)
    .limit(1);
  
  if (!result || result.length === 0) return undefined;
  return result[0] as unknown as MagicLink;
}

/**
 * Mark magic link as used
 */
export async function useMagicLink(token: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date().toISOString();

  // Use raw SQL for magic_link table
  await db.run(sql`UPDATE magic_link SET used_at = ${now} WHERE token = ${token}`);
}
