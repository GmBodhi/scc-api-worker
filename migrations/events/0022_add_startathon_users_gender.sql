-- Migration number: 0022 	 2026-07-18T00:00:00.000Z
ALTER TABLE startathon_users ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other'));
