CREATE TABLE IF NOT EXISTS mentorships (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    batch TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    technologies TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);
