CREATE TABLE startathon_users (
  user_id       TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  role          TEXT NOT NULL CHECK (role IN ('leader','member')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  college       TEXT,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_startathon_users_team_id ON startathon_users (team_id);
