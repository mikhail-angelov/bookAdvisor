ALTER TABLE `books` ADD `updated_at` text;--> statement-breakpoint
UPDATE `books`
SET `updated_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP)
WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `books_url_unique` ON `books` (`url`);
