-- A no-answer team goes back into the pool rather than being marked done —
-- you want to ring them again. But bare re-dealing loses the fact that
-- anyone ever tried, so the row survives and counts attempts instead.
--
-- Incremented on every filed call; preserved when the team is re-claimed.
ALTER TABLE startathon_sr_calls ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
