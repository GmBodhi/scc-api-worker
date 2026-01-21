-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    read INTEGER DEFAULT 0,
    link TEXT,
    created_at INTEGER NOT NULL,
    read_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create index on user_id for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);

-- Create index on read status for filtering
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (read);

-- Create composite index for user + read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- Create composite index for user + created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
