-- Create idea_comments table for commenting on ideas
CREATE TABLE idea_comments (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT(unixepoch ()),
    updated_at INTEGER NOT NULL DEFAULT(unixepoch ()),
    FOREIGN KEY (idea_id) REFERENCES ideas (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Indexes for faster queries
CREATE INDEX idx_idea_comments_idea_id ON idea_comments (idea_id);

CREATE INDEX idx_idea_comments_user_id ON idea_comments (user_id);

CREATE INDEX idx_idea_comments_created_at ON idea_comments (created_at DESC);
