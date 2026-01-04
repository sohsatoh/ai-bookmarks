PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL DEFAULT 'system',
	`url` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`major_category_id` integer NOT NULL,
	`minor_category_id` integer NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`read_status` text DEFAULT 'unread' NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`major_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`minor_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bookmarks`("id", "user_id", "url", "title", "description", "major_category_id", "minor_category_id", "is_starred", "read_status", "is_archived", "display_order", "version", "created_at", "updated_at") SELECT "id", COALESCE("user_id", 'system'), "url", "title", "description", "major_category_id", "minor_category_id", "is_starred", "read_status", "is_archived", "display_order", "version", "created_at", "updated_at" FROM `bookmarks`;--> statement-breakpoint
DROP TABLE `bookmarks`;--> statement-breakpoint
ALTER TABLE `__new_bookmarks` RENAME TO `bookmarks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `categories` ADD `user_id` text NOT NULL DEFAULT 'system' REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;