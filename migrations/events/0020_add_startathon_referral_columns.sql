-- Migration number: 0020 	 2026-07-17T00:00:00.000Z
ALTER TABLE startathon_teams ADD COLUMN referral_code TEXT;
ALTER TABLE startathon_teams ADD COLUMN referred_by TEXT REFERENCES startathon_teams(team_id);

UPDATE startathon_teams
SET referral_code = upper(substr(lower(hex(randomblob(8))), 1, 8))
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX idx_startathon_teams_referral_code ON startathon_teams (referral_code);
CREATE INDEX idx_startathon_teams_referred_by ON startathon_teams (referred_by);
