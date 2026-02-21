ALTER TABLE `books` RENAME COLUMN "author_first_name" TO "authors";--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `author_last_name`;