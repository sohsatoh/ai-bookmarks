-- Add is_starred column to bookmarks table
ALTER TABLE bookmarks ADD COLUMN is_starred INTEGER DEFAULT 0 NOT NULL;
