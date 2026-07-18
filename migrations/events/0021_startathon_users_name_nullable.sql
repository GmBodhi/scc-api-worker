-- Migration number: 0021 	 2026-07-18T00:00:00.000Z
-- name is no longer collected at invite time; it's set when the invitee onboards.
-- SQLite can't drop a NOT NULL constraint in place, so rebuild the table.

CREATE TABLE startathon_users_new (
  user_id       TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  team_id       TEXT REFERENCES startathon_teams(team_id),
  role          TEXT CHECK (role IN ('leader','member')),
  created_at    INTEGER NOT NULL,
  CHECK ((team_id IS NULL AND role IS NULL) OR (team_id IS NOT NULL AND role IS NOT NULL))
);

INSERT INTO startathon_users_new
  SELECT user_id, name, email, phone, college, password_hash, google_id, team_id, role, created_at
  FROM startathon_users;

DROP TABLE startathon_users;
ALTER TABLE startathon_users_new RENAME TO startathon_users;

CREATE INDEX idx_startathon_users_team_id ON startathon_users (team_id);
