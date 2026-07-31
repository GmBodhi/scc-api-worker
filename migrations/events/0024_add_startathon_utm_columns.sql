-- Migration number: 0024 	 2026-07-25T00:00:00.000Z
ALTER TABLE startathon_users ADD COLUMN utm_source TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_medium TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_campaign TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_term TEXT;
ALTER TABLE startathon_users ADD COLUMN utm_content TEXT;

ALTER TABLE startathon_teams ADD COLUMN utm_source TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_medium TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_campaign TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_term TEXT;
ALTER TABLE startathon_teams ADD COLUMN utm_content TEXT;
