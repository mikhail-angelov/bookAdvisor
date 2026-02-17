CREATE TABLE `crawl_history` (
	`id` text PRIMARY KEY NOT NULL,
	`forum_id` integer NOT NULL,
	`pages_crawled` integer DEFAULT 0,
	`torrents_found` integer DEFAULT 0,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text DEFAULT 'running',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `torrent_details` (
	`id` text PRIMARY KEY NOT NULL,
	`torrent_id` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`category` text,
	`forum_name` text,
	`registered_until` text,
	`seeders` integer DEFAULT 0,
	`last_checked` text,
	`magnet_link` text,
	`torrent_file` text,
	`created_at` text,
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
	FOREIGN KEY (`torrent_id`) REFERENCES `torrents`(`topic_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `torrents` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`forum_id` integer NOT NULL,
	`size` text,
	`seeds` integer DEFAULT 0,
	`leechers` integer DEFAULT 0,
	`downloads` integer DEFAULT 0,
	`author` text,
	`created_at` text,
	`last_updated` text,
	`status` text DEFAULT 'active'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `torrents_topic_id_unique` ON `torrents` (`topic_id`);