-- Inflow / Enterprise Ingestion Firewall conversation schema (SQLite)
-- The API creates these tables automatically on startup in SQLITE_PATH
-- (default backend/data/chat.db). This file is for reference.
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,                      -- UUID string
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TEXT NOT NULL,                 -- ISO-8601 UTC timestamp
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at);
