-- Student-relations calling: who calls, and what came back.
--
-- The SR team has no login of its own; these routes are guarded by the
-- shared TOKEN header and identify the caller by caller_id. The registry
-- exists so per-caller counts aren't fragmented by typed-in names.
CREATE TABLE startathon_sr_callers (
  caller_id  TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- One row per team, doubling as the claim lock and the feedback record.
-- The row existing IS the claim; outcome IS NULL means claimed but not
-- yet called. Keeping both in one table means reading "my list" needs no
-- join and "is this team done" is a single non-null check.
--
-- Stale claims need no cron: /sr/calls/claim overwrites any row that is
-- still outcome IS NULL after the expiry window, so an abandoned list
-- returns to the pool on the next pull. A row with an outcome is never
-- re-dealt.
CREATE TABLE startathon_sr_calls (
  team_id    TEXT PRIMARY KEY REFERENCES startathon_teams(team_id),
  caller_id  TEXT NOT NULL REFERENCES startathon_sr_callers(caller_id),
  claimed_at INTEGER NOT NULL,
  -- reached | no-answer | wrong-number | call-back-later
  outcome    TEXT,
  -- JSON array of {question, answer}. Free-form on purpose: the SR form
  -- changes week to week and shouldn't need a migration to do it.
  feedback   TEXT,
  called_at  INTEGER,
  updated_at INTEGER
);

CREATE INDEX idx_startathon_sr_calls_caller ON startathon_sr_calls (caller_id);
CREATE INDEX idx_startathon_sr_calls_outcome ON startathon_sr_calls (outcome);
