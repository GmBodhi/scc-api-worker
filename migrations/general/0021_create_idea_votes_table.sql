-- Create idea_votes table for voting on ideas
-- Only verified users can vote
CREATE TABLE idea_votes (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT(unixepoch ()),
    FOREIGN KEY (idea_id) REFERENCES ideas (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE (idea_id, user_id) -- One vote per user per idea
);

-- Indexes for faster queries
CREATE INDEX idx_idea_votes_idea_id ON idea_votes (idea_id);

CREATE INDEX idx_idea_votes_user_id ON idea_votes (user_id);
