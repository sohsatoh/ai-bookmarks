-- Add read_status and is_archived columns to bookmarks table
ALTER TABLE bookmarks ADD COLUMN read_status TEXT DEFAULT 'unread' NOT NULL;
ALTER TABLE bookmarks ADD COLUMN is_archived INTEGER DEFAULT 0 NOT NULL;
