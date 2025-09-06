CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    batch TEXT NOT NULL,
    rollNo TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phoneNumber TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending')) DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);