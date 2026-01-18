-- Passkey credentials table
CREATE TABLE passkey_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    transports TEXT,
    device_name TEXT,
    created_at INTEGER DEFAULT(unixepoch ()),
    last_used_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_passkey_user_id ON passkey_credentials (user_id);

CREATE INDEX idx_passkey_credential_id ON passkey_credentials (credential_id);
