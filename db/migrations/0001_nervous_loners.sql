ALTER TABLE `torrents` ADD `comments_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `torrents` ADD `last_comment_date` text;