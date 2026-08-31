-- Per-person event logistics: what they eat, how they travel, when they arrive.
--
-- One row per participant rather than per team, because every field here
-- differs between teammates — two people on the same team routinely arrive on
-- different trains. It also means two members filling the form at once cannot
-- clobber each other, the same reasoning that gave application members their
-- own rows rather than one JSON blob on the team.
--
-- Every answer is nullable. A row exists as soon as anything is answered, and
-- an unanswered field is NULL rather than a default, so "hasn't said" stays
-- distinguishable from "said no" — which matters for chasing people.
CREATE TABLE startathon_participant_logistics (
  user_id               TEXT PRIMARY KEY REFERENCES startathon_users(user_id),
  -- Denormalised from startathon_users so the sheet export and any roster
  -- query can group by team without a join. Rewritten on every write, so a
  -- member who switches teams carries their answers to the new one.
  team_id               TEXT NOT NULL REFERENCES startathon_teams(team_id),

  -- 'veg' | 'non-veg'. Two values on purpose: it is the split the kitchen
  -- actually cooks to. Anything finer (vegan, Jain, allergies) goes in
  -- dietary_notes as free text, where it reaches a human instead of being
  -- forced into an enum that always misses a case.
  food_preference       TEXT CHECK (food_preference IN ('veg', 'non-veg')),
  dietary_notes         TEXT,

  travel_mode           TEXT CHECK (travel_mode IN ('train', 'bus', 'car', 'flight', 'own', 'other')),
  -- Unix seconds. Nullable next to arrival_note because plenty of people know
  -- "sometime Friday evening" long before they know a time.
  arrival_at            INTEGER,
  arrival_note          TEXT,

  needs_travel_guidance INTEGER NOT NULL DEFAULT 0,
  guidance_note         TEXT,

  -- Who last wrote the row: the participant, or the leader filling it in on
  -- their behalf. Worth keeping — an answer entered by someone else is worth
  -- less confidence when the catering count is being finalised.
  updated_by            TEXT NOT NULL REFERENCES startathon_users(user_id),
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);

CREATE INDEX idx_startathon_logistics_team
  ON startathon_participant_logistics (team_id);
