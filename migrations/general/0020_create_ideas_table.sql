-- Create ideas table for "Host Your Own Events" feature
-- Users can propose event ideas that others can vote on and comment on
CREATE TABLE ideas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT(unixepoch ()),
    updated_at INTEGER NOT NULL DEFAULT(unixepoch ()),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX idx_ideas_user_id ON ideas (user_id);

CREATE INDEX idx_ideas_created_at ON ideas (created_at DESC);
