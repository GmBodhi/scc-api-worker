-- Add Google OAuth support to users table
ALTER TABLE users ADD COLUMN google_id TEXT;

-- Create unique index for faster lookups and uniqueness constraint
CREATE UNIQUE INDEX idx_users_google_id ON users (google_id)
WHERE
    google_id IS NOT NULL;
