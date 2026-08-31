-- Row lifetime timestamps for selection payments.
--
-- submitted_at was carrying two jobs it cannot both do: it is rewritten every
-- time a payer corrects their reference, so it answers "when was the current
-- reference filed" and loses "when did this payment first appear". Splitting
-- them out means an edit no longer erases the original filing time, which is
-- what any question about how long a team took to pay depends on.
--
-- submitted_at keeps its narrower meaning and is left in place: it is the
-- timestamp of the reference currently on the row, which is the one the
-- matcher and the sweep reason about.
ALTER TABLE startathon_selection_payments ADD COLUMN created_at INTEGER;
ALTER TABLE startathon_selection_payments ADD COLUMN updated_at INTEGER;

-- Backfill from what the existing rows already know. For a payment never
-- edited these are exactly right; for an edited one created_at is as early as
-- the data allows, which is the honest answer rather than a guess.
UPDATE startathon_selection_payments
SET created_at = COALESCE(created_at, submitted_at),
    updated_at = COALESCE(updated_at, confirmed_at, submitted_at);
