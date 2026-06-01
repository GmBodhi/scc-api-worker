CREATE TABLE email_events (
  id          TEXT PRIMARY KEY,
  waitlist_id TEXT NOT NULL,
  event       TEXT NOT NULL,
  url         TEXT,
  ip          TEXT,
  user_agent  TEXT,
  occurred_at INTEGER NOT NULL
);
