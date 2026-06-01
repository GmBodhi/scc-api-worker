CREATE TABLE startathon_wl (
  waitlist_id   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  college       TEXT NOT NULL,
  phone         TEXT,
  registered_at INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'waitlisted'
);
