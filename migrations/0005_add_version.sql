-- Add version column for optimistic locking
ALTER TABLE categories ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
