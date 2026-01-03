-- Add display_order columns to categories and bookmarks tables
ALTER TABLE categories ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

-- Initialize display_order based on existing created_at (older items get lower order numbers)
UPDATE categories SET display_order = id;
UPDATE bookmarks SET display_order = id;
