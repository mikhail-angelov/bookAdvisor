ALTER TABLE `books` ADD `embedding` blob;--> statement-breakpoint
CREATE UNIQUE INDEX `books_url_unique` ON `books` (`url`);
