-- Shared daily send counter for outbound bulk email.
--
-- The sending account is capped at 300 messages per day across *everything*,
-- including the transactional password-reset and payment-confirmation mail that
-- users are actively waiting on. Bulk jobs therefore cannot simply send as fast
-- as their own batch size allows: without a shared ceiling, two notifiers at 10
-- per half-hourly tick would attempt ~960 sends a day and starve transactional
-- delivery long before the day was out.
--
-- One row per UTC day, holding sends already claimed by bulk jobs. Every such
-- job claims quota here before sending and sends only what it was granted, so
-- adding a third job later divides the same pool rather than multiplying the
-- total. Old rows are harmless -- a few dozen bytes a day -- and are worth
-- keeping as a send-volume history.
CREATE TABLE email_send_budget (
  day  TEXT PRIMARY KEY,
  sent INTEGER NOT NULL
);
