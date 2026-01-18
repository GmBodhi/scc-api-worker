-- Sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT(unixepoch ()),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX idx_session_user_id ON sessions (user_id);

CREATE INDEX idx_session_expires_at ON sessions (expires_at);
