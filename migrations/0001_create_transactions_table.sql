CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    vpa TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    ref TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);