-- Create HackerRank event registrations table
CREATE TABLE IF NOT EXISTS hackerrank_registrations (
    registration_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL DEFAULT 'hackerrank_1',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    batch TEXT NOT NULL,
    registered_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at INTEGER DEFAULT(unixepoch ()),
    updated_at INTEGER DEFAULT(unixepoch ())
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_hackerrank_user_id ON hackerrank_registrations (user_id);

-- Create index on email for duplicate checking
CREATE INDEX IF NOT EXISTS idx_hackerrank_email ON hackerrank_registrations (email);

-- Create index on phone for duplicate checking
CREATE INDEX IF NOT EXISTS idx_hackerrank_phone ON hackerrank_registrations (phone);

-- Create composite index for user + event duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_hackerrank_user_event ON hackerrank_registrations (user_id, event_id);

-- Create index on registration date for sorting
CREATE INDEX IF NOT EXISTS idx_hackerrank_registered_at ON hackerrank_registrations (registered_at DESC);
