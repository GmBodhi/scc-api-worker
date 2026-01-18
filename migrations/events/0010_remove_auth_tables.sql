-- Remove auth tables from events database
-- These tables have been moved to GENERAL_DB

DROP TABLE IF EXISTS refresh_tokens;

DROP TABLE IF EXISTS passkey_credentials;

DROP TABLE IF EXISTS sessions;

DROP TABLE IF EXISTS challenges;

DROP TABLE IF EXISTS users;

-- Drop indexes if they exist
DROP INDEX IF EXISTS idx_users_email;

DROP INDEX IF EXISTS idx_users_etlab_username;

DROP INDEX IF EXISTS idx_session_user_id;

DROP INDEX IF EXISTS idx_session_expires_at;
