-- Challenges table (optional, can use KV instead)
CREATE TABLE challenges (
    challenge TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL, -- 'registration' or 'authentication'
    created_at INTEGER DEFAULT(unixepoch ()),
    expires_at INTEGER NOT NULL
);

-- Index for cleanup operations
CREATE INDEX idx_challenges_expires ON challenges (expires_at);
