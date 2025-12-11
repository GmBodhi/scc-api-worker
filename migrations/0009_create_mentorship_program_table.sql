CREATE TABLE IF NOT EXISTS mentorship_program (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    batch TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    experienceLevel TEXT NOT NULL CHECK (experienceLevel IN ('Beginner', 'Intermediate', 'Advanced')),
    projectIdea TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('registered')) DEFAULT 'registered',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);
