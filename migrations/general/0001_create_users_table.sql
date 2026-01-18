-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    etlab_username TEXT UNIQUE,
    profile_photo_url TEXT,
    password_hash TEXT,
    created_at INTEGER DEFAULT(unixepoch ()),
    updated_at INTEGER DEFAULT(unixepoch ())
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users (email);

CREATE INDEX idx_users_etlab_username ON users (etlab_username);
