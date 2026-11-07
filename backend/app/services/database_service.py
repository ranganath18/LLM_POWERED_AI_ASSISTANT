"""Conversation storage on PostgreSQL (Supabase) or SQLite.

- DATABASE_URL set (production): PostgreSQL through psycopg, with a small
  connection pool so each request does not open a new TLS connection.
- DATABASE_URL not set (local development, tests): a SQLite file
  (SQLITE_PATH, default backend/data/chat.db) using Python's built-in sqlite3.

The SQL is written once with "?" placeholders and converted to "%s" for
PostgreSQL. Tables are created (and upgraded) automatically, on startup or on
first use. Any database failure is raised as DatabaseUnavailable so the API can
answer with a clean 503 instead of leaking a driver error to the browser.

Archiving: a chat with archived_at set is hidden from the sidebar and is deleted
for good ARCHIVE_RETENTION_DAYS later. Writing in an archived chat restores it.
"""
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from app.config import ARCHIVE_RETENTION_DAYS, DATABASE_URL, SQLITE_PATH

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 12  # only the latest 12 messages are sent to the LLM

# Module-level so tests can force SQLite and point it at a temporary file.
USE_POSTGRES = bool(DATABASE_URL)
db_path = Path(SQLITE_PATH)

POSTGRES_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS messages (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""",
    # Databases created before archiving existed (e.g. the first production deploy) get the column here.
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TEXT",
    "CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(archived_at)",
]

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT  -- NULL = active; set = archived
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
"""


class DatabaseUnavailable(Exception):
    """The database could not be reached or a query failed."""


def _now() -> str:
    # ISO-8601 UTC strings sort correctly as text.
    return datetime.now(timezone.utc).isoformat()


def _purge_date(archived_at: str) -> str:
    return (datetime.fromisoformat(archived_at) + timedelta(days=ARCHIVE_RETENTION_DAYS)).isoformat()


class _Connection:
    """Gives SQLite and PostgreSQL connections the same execute() (with "?" placeholders)."""

    def __init__(self, raw, postgres: bool):
        self.raw = raw
        self.postgres = postgres

    def execute(self, sql: str, params: tuple = ()):
        if self.postgres:
            sql = sql.replace("?", "%s")
        return self.raw.execute(sql, params)

    def executescript(self, script: str) -> None:
        self.raw.executescript(script)  # SQLite only


_pool = None
_ready_key: str | None = None  # which database the tables were last created in


def _current_key() -> str:
    return "postgres" if USE_POSTGRES else str(db_path)


def _postgres_pool():
    """One shared pool of PostgreSQL connections, created on first use."""
    global _pool
    if _pool is None:
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            timeout=10,  # fail fast (-> clean 503) instead of hanging when the DB is unreachable
            # Supabase's transaction pooler (port 6543) does not support prepared statements.
            kwargs={"prepare_threshold": None, "connect_timeout": 10},
            # Check a connection before handing it out; idle ones may have been closed.
            check=ConnectionPool.check_connection,
            open=True,
        )
    return _pool


@contextmanager
def _raw_connect() -> Iterator[_Connection]:
    """A connection that commits on success and rolls back on error."""
    if USE_POSTGRES:
        with _postgres_pool().connection() as raw:
            yield _Connection(raw, postgres=True)
        return

    conn = sqlite3.connect(db_path, timeout=10)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield _Connection(conn, postgres=False)
    finally:
        conn.close()


@contextmanager
def _connect() -> Iterator[_Connection]:
    """Like _raw_connect, but creates the tables if needed and reports failures cleanly."""
    try:
        if _ready_key != _current_key():
            initialize_database()
        with _raw_connect() as conn:
            yield conn
    except DatabaseUnavailable:
        raise
    except Exception as exc:  # sqlite3.Error, psycopg errors, pool timeouts ...
        logger.error("Database operation failed: %s", exc)
        raise DatabaseUnavailable("The database is not available right now.") from exc


def database_kind() -> str:
    return "postgres" if USE_POSTGRES else "sqlite"


def initialize_database() -> None:
    """Create or upgrade the tables. Safe to run on every start."""
    global _ready_key
    try:
        if USE_POSTGRES:
            with _raw_connect() as conn:
                for statement in POSTGRES_SCHEMA:
                    conn.execute(statement)
        else:
            db_path.parent.mkdir(parents=True, exist_ok=True)
            with _raw_connect() as conn:
                # WAL lets the API read history while another request is writing.
                conn.execute("PRAGMA journal_mode = WAL")
                conn.executescript(SQLITE_SCHEMA)
                # Local databases created before archiving existed don't have the column yet.
                columns = {row[1] for row in conn.execute("PRAGMA table_info(conversations)").fetchall()}
                if "archived_at" not in columns:
                    conn.execute("ALTER TABLE conversations ADD COLUMN archived_at TEXT")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(archived_at)")
    except Exception as exc:
        raise DatabaseUnavailable("The database is not available right now.") from exc
    _ready_key = _current_key()


def check_database() -> bool:
    """True if the database answers a simple query (used by /health)."""
    try:
        with _connect() as conn:
            conn.execute("SELECT 1 FROM conversations LIMIT 1")
        return True
    except DatabaseUnavailable:
        return False


def ensure_conversation(session_id: str, title: str = "New Chat") -> None:
    now = _now()
    with _connect() as conn:
        conn.execute(
            # ON CONFLICT ... DO NOTHING works in both SQLite and PostgreSQL.
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
            (session_id, title[:100] or "New Chat", now, now),
        )


def add_chat_message(session_id: str, role: str, content: str) -> None:
    if role not in {"user", "assistant"}:
        raise ValueError("Conversation role must be 'user' or 'assistant'.")
    ensure_conversation(session_id, content[:70] if role == "user" else "New Chat")
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, now),
        )
        # Writing in an archived chat brings it back (archived_at = NULL), like ChatGPT.
        # The first user message also becomes the title of a "New Chat".
        if role == "user":
            conn.execute(
                "UPDATE conversations SET updated_at = ?, archived_at = NULL, title = CASE WHEN title = 'New Chat' THEN ? ELSE title END WHERE id = ?",
                (now, content[:70] or "New Chat", session_id),
            )
        else:
            conn.execute(
                "UPDATE conversations SET updated_at = ?, archived_at = NULL WHERE id = ?",
                (now, session_id),
            )


def get_chat_history(session_id: str) -> list[dict[str, str]]:
    """Last 12 messages as {role, content}, oldest first, ready to send to Groq."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
            (session_id, MAX_HISTORY_MESSAGES),
        ).fetchall()
    return [{"role": role, "content": content} for role, content in reversed(rows)]


def list_conversations(limit: int = 30) -> list[dict[str, Any]]:
    """Active (not archived) chats, newest first, for the sidebar."""
    with _connect() as conn:
        rows = conn.execute(
            """SELECT c.id, c.title, c.updated_at,
            (SELECT content FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview
            FROM conversations c WHERE c.archived_at IS NULL ORDER BY c.updated_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    return [
        {"session_id": r[0], "title": r[1], "updated_at": r[2], "preview": r[3] or "Start a conversation"}
        for r in rows
    ]


def archive_conversation(session_id: str) -> bool:
    """Move a chat to the archive. Returns False if it doesn't exist (or is already archived)."""
    with _connect() as conn:
        cursor = conn.execute(
            "UPDATE conversations SET archived_at = ? WHERE id = ? AND archived_at IS NULL",
            (_now(), session_id),
        )
    return cursor.rowcount > 0


def restore_conversation(session_id: str) -> bool:
    """Bring an archived chat back. Returns False if it isn't in the archive."""
    with _connect() as conn:
        cursor = conn.execute(
            "UPDATE conversations SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL",
            (session_id,),
        )
    return cursor.rowcount > 0


def list_archived_conversations() -> list[dict[str, Any]]:
    """Archived chats, most recently archived first, with the date each will be deleted."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, title, archived_at FROM conversations WHERE archived_at IS NOT NULL ORDER BY archived_at DESC"
        ).fetchall()
    return [
        {"session_id": r[0], "title": r[1], "archived_at": r[2], "delete_at": _purge_date(r[2])}
        for r in rows
    ]


def purge_expired_archives() -> int:
    """Permanently delete chats archived more than ARCHIVE_RETENTION_DAYS ago. Returns how many."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ARCHIVE_RETENTION_DAYS)).isoformat()
    with _connect() as conn:
        cursor = conn.execute(
            "DELETE FROM conversations WHERE archived_at IS NOT NULL AND archived_at < ?",
            (cutoff,),
        )
    return cursor.rowcount


def get_archive_status(session_id: str) -> dict[str, str] | None:
    """{"archived_at", "delete_at"} if the chat is archived, otherwise None."""
    with _connect() as conn:
        row = conn.execute("SELECT archived_at FROM conversations WHERE id = ?", (session_id,)).fetchone()
    if not row or not row[0]:
        return None
    return {"archived_at": row[0], "delete_at": _purge_date(row[0])}


def rename_conversation(session_id: str, title: str) -> bool:
    """Change a conversation's title. Returns False if it doesn't exist."""
    with _connect() as conn:
        cursor = conn.execute("UPDATE conversations SET title = ? WHERE id = ?", (title[:100], session_id))
    return cursor.rowcount > 0


def delete_conversation(session_id: str) -> bool:
    """Delete a conversation and (via ON DELETE CASCADE) all its messages."""
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM conversations WHERE id = ?", (session_id,))
    return cursor.rowcount > 0


def get_conversation_messages(session_id: str) -> list[dict[str, Any]]:
    """Full conversation (not just the last 12), for reopening a chat."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, id",
            (session_id,),
        ).fetchall()
    return [{"role": r[0], "content": r[1], "created_at": r[2]} for r in rows]
