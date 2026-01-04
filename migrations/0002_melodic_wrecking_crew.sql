CREATE TABLE `file_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `file_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_categories_name_unique` ON `file_categories` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`sanitized_filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`sha256_hash` text NOT NULL,
	`title` text,
	`description` text,
	`major_category_id` integer,
	`minor_category_id` integer,
	`ai_analysis_status` text DEFAULT 'pending' NOT NULL,
	`ai_analysis_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`major_category_id`) REFERENCES `file_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`minor_category_id`) REFERENCES `file_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_files`("id", "user_id", "original_filename", "sanitized_filename", "r2_key", "mime_type", "file_size", "sha256_hash", "title", "description", "major_category_id", "minor_category_id", "ai_analysis_status", "ai_analysis_error", "created_at", "updated_at") SELECT "id", "user_id", "original_filename", "sanitized_filename", "r2_key", "mime_type", "file_size", "sha256_hash", "title", "description", "major_category_id", "minor_category_id", "ai_analysis_status", "ai_analysis_error", "created_at", "updated_at" FROM `files`;--> statement-breakpoint
DROP TABLE `files`;--> statement-breakpoint
ALTER TABLE `__new_files` RENAME TO `files`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `files_r2_key_unique` ON `files` (`r2_key`);