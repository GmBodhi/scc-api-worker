-- Per-caller tokens.
--
-- Replaces "everyone shares SR_TOKEN and says who they are in the body",
-- where any holder could file calls as any colleague and a single lost phone
-- meant rotating the credential for the whole team. Now the token IS the
-- identity: the worker resolves it to a caller, and caller_id is no longer
-- accepted from the client at all.
--
-- SR_TOKEN survives as the organiser/admin key — creating callers, rotating
-- their tokens, and reading the whole campaign.
--
-- Added plain then indexed, because SQLite can't ALTER TABLE ADD COLUMN with
-- a UNIQUE constraint. Existing callers are backfilled rather than left null
-- so nobody is locked out by this migration.
ALTER TABLE startathon_sr_callers ADD COLUMN token TEXT;

UPDATE startathon_sr_callers
   SET token = 'sr_' || lower(hex(randomblob(16)))
 WHERE token IS NULL;

CREATE UNIQUE INDEX idx_startathon_sr_callers_token
  ON startathon_sr_callers (token);
