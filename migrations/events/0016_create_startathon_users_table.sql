CREATE TABLE startathon_users (
  user_id       TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
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

CREATE INDEX idx_startathon_users_team_id ON startathon_users (team_id);
