-- Replaces startathon_ideas (0023) with the application-stage schema.
-- The 5-slide deck and the 60s video are the actual submission, so this
-- row holds only what has to be queryable (title/summary) plus the one
-- thing teams reliably under-supply in a deck: evidence that the problem
-- exists. Architecture and tech stack are deliberately absent — the event
-- format doc rules them out at application stage.
--
-- IF EXISTS/IF NOT EXISTS throughout: 0023 was never committed, so it may
-- or may not have been applied in a given environment.
DROP TABLE IF EXISTS startathon_ideas;

CREATE TABLE IF NOT EXISTS startathon_applications (
  team_id          TEXT PRIMARY KEY REFERENCES startathon_teams(team_id),
  title            TEXT NOT NULL,
  summary          TEXT NOT NULL,
  problem_evidence TEXT NOT NULL,
  deck_url         TEXT NOT NULL,
  video_url        TEXT NOT NULL,
  -- JSON array of {kind, url?, description}. NULL means the team never
  -- answered; '[]' means they explicitly declared nothing. The two are
  -- kept distinct because undeclared prior work is a penalty offence.
  prior_work       TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER
);

-- One row per member who filled anything in. Every field is optional, so
-- no row simply means that member wrote nothing.
CREATE TABLE IF NOT EXISTS startathon_application_members (
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  user_id       TEXT NOT NULL REFERENCES startathon_users(user_id),
  about         TEXT,
  resume_url    TEXT,
  github        TEXT,
  linkedin      TEXT,
  project_links TEXT,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_startathon_application_members_user
  ON startathon_application_members(user_id);
