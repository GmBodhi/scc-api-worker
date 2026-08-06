-- Delivery ledger for Startathon announcement blasts.
--
-- Announcement *content* is not stored here: it lives in code under
-- src/announcements/, keyed by the slug written into announcement_id. This
-- table answers exactly one question -- "does this user still need this
-- announcement?" -- which is what lets the cron drain a blast in small batches
-- across many ticks without a state column on startathon_users.
--
-- The composite primary key is the idempotency guarantee: a second 'sent' row
-- for the same pair cannot be recorded, so a user cannot be emailed twice.
--
-- attempts exists so a failed send is retryable rather than terminal. The
-- sender shares a capped daily quota (see email_send_budget), and provider
-- rejections near that ceiling are transient -- treating the first failure as
-- final would silently drop every recipient the blast happened to hit the wall
-- with. The notifier retries a 'failed' row on later ticks and gives up only
-- once attempts reaches its ceiling, which is what stops a genuinely dead
-- address from being retried forever.
CREATE TABLE startathon_announcement_deliveries (
  announcement_id TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES startathon_users(user_id),
  status          TEXT NOT NULL CHECK (status IN ('sent','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_startathon_announcement_deliveries_announcement
  ON startathon_announcement_deliveries (announcement_id);
