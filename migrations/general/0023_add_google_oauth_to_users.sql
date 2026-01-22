-- Add Google OAuth support to users table
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_users_google_id ON users (google_id);
