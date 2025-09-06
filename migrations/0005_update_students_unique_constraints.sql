-- SQLite doesn't support dropping columns directly, so we need to recreate the table
-- Create new table without rollNo field and with phoneNumber unique constraint
CREATE TABLE students_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    batch TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phoneNumber TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending')) DEFAULT 'pending',
    upiRef TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

-- Copy data from old table to new table (excluding rollNo)
INSERT INTO students_new (id, name, batch, email, phoneNumber, status, upiRef, createdAt, updatedAt) 
SELECT id, name, batch, email, phoneNumber, status, upiRef, createdAt, updatedAt FROM students;

-- Drop old table
DROP TABLE students;

-- Rename new table to original name
ALTER TABLE students_new RENAME TO students;