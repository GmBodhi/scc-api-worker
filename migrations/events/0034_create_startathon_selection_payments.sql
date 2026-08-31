-- The ₹250-per-head selection fee, paid after shortlisting.
--
-- Split across two tables because one payment can cover up to four people: a
-- leader who pays ₹1000 in one UPI transfer produces one payment row and four
-- cover rows. Storing it per member instead would mean four rows holding the
-- same reference, and no way to say "these four are the same transfer".
--
-- Entirely separate from the ₹100 registration fee (startathon_teams.
-- transaction_ref): different amount, different payer, different lifecycle,
-- and neither can be credited as the other because the amounts never overlap.
CREATE TABLE startathon_selection_payments (
  payment_id      TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES startathon_teams(team_id),
  -- Who submitted it. Only this user may edit the reference afterwards; a
  -- covered member cannot rewrite the leader's transfer.
  payer_user_id   TEXT NOT NULL REFERENCES startathon_users(user_id),
  transaction_ref TEXT NOT NULL,
  -- 250 x the number of cover rows. Held here so the matcher can compare
  -- against startathon_transactions.amount without recounting the join.
  amount          INTEGER NOT NULL,
  -- 'submitted' = reference filed, no matching bank SMS seen yet.
  -- 'confirmed'  = matched a ₹250/500/750/1000 transaction and claimed it.
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'confirmed')),
  submitted_at    INTEGER NOT NULL,
  confirmed_at    INTEGER
);

-- One reference, one payment. This is what answers 400 on a reference already
-- filed by someone else -- including a member trying to reuse their leader's.
CREATE UNIQUE INDEX idx_startathon_selection_payments_ref
  ON startathon_selection_payments (transaction_ref);

CREATE INDEX idx_startathon_selection_payments_team
  ON startathon_selection_payments (team_id);

-- The sweep's working set: submitted rows, oldest first.
CREATE INDEX idx_startathon_selection_payments_status
  ON startathon_selection_payments (status, submitted_at);

CREATE TABLE startathon_selection_payment_covers (
  payment_id TEXT NOT NULL
               REFERENCES startathon_selection_payments(payment_id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES startathon_users(user_id),
  PRIMARY KEY (payment_id, user_id)
);

-- A member is covered by at most one payment, ever. Makes double payment
-- structurally impossible rather than a check someone has to remember: the
-- second payer's insert fails and the endpoint answers 409 naming them.
-- Editing an open payment rewrites its own cover rows in the same batch, so
-- growing ₹250 -> ₹1000 does not trip this.
CREATE UNIQUE INDEX idx_startathon_selection_covers_user
  ON startathon_selection_payment_covers (user_id);
