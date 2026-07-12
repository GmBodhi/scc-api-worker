CREATE TABLE startathon_invites (
  invite_id     TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES startathon_teams(team_id),
  invited_email TEXT NOT NULL,
  invited_by    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    INTEGER NOT NULL,
  responded_at  INTEGER
);

CREATE INDEX idx_startathon_invites_email_status ON startathon_invites (invited_email, status);
CREATE INDEX idx_startathon_invites_team_id ON startathon_invites (team_id);
