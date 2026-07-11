CREATE TABLE startathon_transactions (
  id        TEXT PRIMARY KEY,
  vpa       TEXT NOT NULL,
  amount    REAL NOT NULL,
  date      TEXT NOT NULL,
  ref       TEXT NOT NULL UNIQUE,
  status    TEXT NOT NULL DEFAULT 'unused',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
