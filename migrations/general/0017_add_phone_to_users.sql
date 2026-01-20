-- Add phone number to users table
ALTER TABLE users ADD COLUMN phone TEXT;

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
