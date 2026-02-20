CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`crawl_id` text NOT NULL,
	`url` text,
	`title` text NOT NULL,
	`category` text DEFAULT 'Российская фантастика' NOT NULL,
	`external_id` integer,
	`size` text,
	`seeds` integer DEFAULT 0,
	`leechers` integer DEFAULT 0,
	`downloads` integer DEFAULT 0,
	`comments_count` integer DEFAULT 0,
	`last_comment_date` text,
	`author_name` text,
	`author_posts` integer,
	`topic_title` text,
	`year` integer,
	`author_first_name` text,
	`author_last_name` text,
	`performer` text,
	`series` text,
	`book_number` text,
	`genre` text,
	`edition_type` text,
	`audio_codec` text,
	`bitrate` text,
	`duration` text,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_crawl_id_unique` ON `books` (`crawl_id`);--> statement-breakpoint
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `user_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`annotation` text,
	`read_status` text DEFAULT 'unread',
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_book_idx` ON `user_annotations` (`user_id`,`book_id`);