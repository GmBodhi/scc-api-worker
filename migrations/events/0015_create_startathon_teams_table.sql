CREATE TABLE startathon_teams (
  team_id         TEXT PRIMARY KEY,
  team_name       TEXT NOT NULL UNIQUE,
  leader_id       TEXT NOT NULL,
  join_code       TEXT NOT NULL UNIQUE,
  transaction_ref TEXT,
  status          TEXT NOT NULL DEFAULT 'payment-pending',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER
);
