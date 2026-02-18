ALTER TABLE `user_annotations` ADD `book_id` text NOT NULL REFERENCES books(id);--> statement-breakpoint
CREATE UNIQUE INDEX `user_book_idx` ON `user_annotations` (`user_id`,`book_id`);