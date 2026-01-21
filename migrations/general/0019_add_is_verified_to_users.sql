-- Add is_verified column to users table
-- This tracks whether a user has verified their account via EtLab
-- Default to 0 (false) for new users, existing users will be set to 1 (true) if they have etlab_username
ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0 NOT NULL;

-- Set is_verified to 1 for all existing users who have an etlab_username
-- This preserves the verification status of existing users
UPDATE users SET is_verified = 1 WHERE etlab_username IS NOT NULL;

-- Create index for faster lookups on verified users
CREATE INDEX idx_users_is_verified ON users (is_verified);
