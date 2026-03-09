-- Create MCP Workshop registrations table
CREATE TABLE IF NOT EXISTS mcp_workshop_registrations (
    registration_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL DEFAULT 'mcp_workshop_1',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    jdk_installed TEXT NOT NULL CHECK (jdk_installed IN ('already_installed', 'will_follow_tutorial')),
    spring_tutorial INTEGER NOT NULL DEFAULT 1,
    registered_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'registered',
    created_at INTEGER DEFAULT(unixepoch()),
    updated_at INTEGER DEFAULT(unixepoch())
);

-- Prevent the same user from registering for the same event twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_workshop_user_event ON mcp_workshop_registrations (user_id, event_id);

-- Fast lookups by user
CREATE INDEX IF NOT EXISTS idx_mcp_workshop_user_id ON mcp_workshop_registrations (user_id);

-- Duplicate checks on contact details
CREATE INDEX IF NOT EXISTS idx_mcp_workshop_email ON mcp_workshop_registrations (email);
CREATE INDEX IF NOT EXISTS idx_mcp_workshop_whatsapp ON mcp_workshop_registrations (whatsapp);

-- Sorting by registration date
CREATE INDEX IF NOT EXISTS idx_mcp_workshop_registered_at ON mcp_workshop_registrations (registered_at DESC);
