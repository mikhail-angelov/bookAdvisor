import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Users table
 */
export const user = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username"),
  email: text("email").unique().notNull(),
  createdAt: text("created_at").notNull(),
});

export const book = sqliteTable("books", {
  id: text("id").primaryKey(),
  crawlId: text("crawl_id").unique().notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Российская фантастика"),
  externalId: integer("external_id"),
  size: text("size"),
  seeds: integer("seeds").default(0),
  leechers: integer("leechers").default(0),
  downloads: integer("downloads").default(0),
  commentsCount: integer("comments_count").default(0),
  lastCommentDate: text("last_comment_date"),
  authorName: text("author_name"),
  authorPosts: integer("author_posts"),
  topicTitle: text("topic_title"),
  year: integer("year"),
  authorFirstName: text("author_first_name"),
  authorLastName: text("author_last_name"),
  performer: text("performer"),
  series: text("series"),
  bookNumber: text("book_number"),
  genre: text("genre"),
  editionType: text("edition_type"),
  audioCodec: text("audio_codec"),
  bitrate: text("bitrate"),
  duration: text("duration"),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: text("created_at"),
});

/**
 * User annotations table
 */
export const userAnnotation = sqliteTable("user_annotations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  bookId: text("book_id")
    .notNull()
    .references(() => book.id),
  rating: integer("rating").notNull().default(0),
  performanceRating: integer("performance_rating").notNull().default(0),
  annotation: text("annotation"),
  readStatus: text("read_status").default("unread"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
}, (table) => {
  return {
    userBookIdx: uniqueIndex("user_book_idx").on(table.userId, table.bookId),
  };
});

// Type exports for TypeScript
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Book = typeof book.$inferSelect;
export type NewBook = typeof book.$inferInsert;
export type UserAnnotation = typeof userAnnotation.$inferSelect;
export type NewUserAnnotation = typeof userAnnotation.$inferInsert;
