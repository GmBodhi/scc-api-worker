-- Create table to track follow-up emails sent to students
CREATE TABLE followup_emails (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    email_sent_at TEXT NOT NULL,
    email_type TEXT NOT NULL DEFAULT 'payment_reminder',
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Create index for efficient querying by student_id
CREATE INDEX idx_followup_emails_student_id ON followup_emails(student_id);

-- Create index for querying by email_sent_at
CREATE INDEX idx_followup_emails_sent_at ON followup_emails(email_sent_at);