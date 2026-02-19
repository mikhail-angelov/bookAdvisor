PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE books ADD COLUMN description text;--> statement-breakpoint
ALTER TABLE books ADD COLUMN image_url text;--> statement-breakpoint
PRAGMA foreign_keys=ON;