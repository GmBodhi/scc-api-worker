CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    studentName TEXT NOT NULL,
    studentBatch TEXT NOT NULL,
    studentEmail TEXT NOT NULL,
    studentPhoneNumber TEXT NOT NULL,
    transactionId TEXT,
    transactionVpa TEXT,
    transactionAmount REAL,
    transactionDate TEXT,
    transactionRef TEXT,
    refundReason TEXT,
    refundedAt TEXT NOT NULL,
    refundedBy TEXT,
    UNIQUE(studentId)
);