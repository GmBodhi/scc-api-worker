-- Delivery ledger for announcement blasts that also go to the waitlist.
--
-- The sibling of startathon_announcement_deliveries (migration 0025), which
-- can only track account holders: its user_id carries a foreign key into
-- startathon_users, and a waitlister has no row there. Rather than loosen that
-- key -- the thing that guarantees a delivery row points at a real recipient --
-- waitlist sends get their own table with its own key into startathon_wl.
--
-- Columns mirror 0025 exactly, and for the same reasons: the composite primary
-- key makes a second 'sent' row for the same pair impossible, and attempts
-- makes a failed send retryable rather than terminal while still bounding how
-- long a dead address is retried.
--
-- Duplicate suppression across the two tables is the notifier's job, not this
-- schema's: it excludes waitlist rows whose address already has an account,
-- and excludes accounts whose address was already mailed as a waitlister. The
-- two ledgers cannot enforce that between themselves.
CREATE TABLE startathon_announcement_wl_deliveries (
  announcement_id TEXT NOT NULL,
  waitlist_id     TEXT NOT NULL REFERENCES startathon_wl(waitlist_id),
  status          TEXT NOT NULL CHECK (status IN ('sent','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, waitlist_id)
);

CREATE INDEX idx_startathon_announcement_wl_deliveries_announcement
  ON startathon_announcement_wl_deliveries (announcement_id);
