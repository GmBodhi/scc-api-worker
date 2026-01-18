-- Drop sessions table (no longer needed after JWT migration)
-- All authentication now uses JWT tokens

DROP TABLE IF EXISTS sessions;

-- Drop indexes
DROP INDEX IF EXISTS idx_session_user_id;

DROP INDEX IF EXISTS idx_session_expires_at;
