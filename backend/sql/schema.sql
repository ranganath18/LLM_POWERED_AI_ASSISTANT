-- IntentDesk AI: conversation schema (reference copy, SQLite dialect)
--
-- The API creates and upgrades these tables automatically on startup
-- (see initialize_database() in app/services/database_service.py), so you never
-- need to run this file by hand. It is documentation: keep it in sync with that
-- function whenever the schema changes.
--
-- PostgreSQL (Supabase) uses the same tables with two differences:
--   * messages.id is  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
--   * there is no PRAGMA / WAL setting
-- Timestamps are stored as ISO-8601 UTC strings, which sort correctly as text.

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,                -- UUID string (the session id)
  title       TEXT NOT NULL DEFAULT 'New Chat',
  created_at  TEXT NOT NULL,                   -- ISO-8601 UTC
  updated_at  TEXT NOT NULL,                   -- ISO-8601 UTC, bumped on every new message
  archived_at TEXT                             -- NULL = active; set = archived (purged after ARCHIVE_RETENTION_DAYS)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_archived
  ON conversations(archived_at);
