from uuid import uuid4

import pytest

from app.services import database_service as db


def test_messages_are_saved_and_read_back_in_order():
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "Where is my order?")
    db.add_chat_message(sid, "assistant", "Please share your order ID.")

    assert db.get_chat_history(sid) == [
        {"role": "user", "content": "Where is my order?"},
        {"role": "assistant", "content": "Please share your order ID."},
    ]
    assert [m["role"] for m in db.get_conversation_messages(sid)] == ["user", "assistant"]


def test_first_user_message_becomes_the_title():
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "I was charged twice")
    db.add_chat_message(sid, "assistant", "Sorry about that.")
    item = db.list_conversations()[0]
    assert item["title"] == "I was charged twice"
    assert item["preview"] == "I was charged twice"


def test_history_sent_to_llm_is_limited_to_12_messages():
    sid = str(uuid4())
    for i in range(10):
        db.add_chat_message(sid, "user", f"q{i}")
        db.add_chat_message(sid, "assistant", f"a{i}")
    assert len(db.get_chat_history(sid)) == 12
    assert len(db.get_conversation_messages(sid)) == 20  # the full chat is still stored


def test_delete_removes_messages_too():
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "hello")
    assert db.delete_conversation(sid) is True
    assert db.get_conversation_messages(sid) == []
    assert db.delete_conversation(sid) is False


def test_invalid_role_is_rejected():
    with pytest.raises(ValueError):
        db.add_chat_message(str(uuid4()), "system", "nope")


def test_unreachable_database_raises_a_clean_error(monkeypatch, tmp_path):
    # A path inside a file (not a folder) can never be opened.
    blocker = tmp_path / "blocker"
    blocker.write_text("x")
    monkeypatch.setattr(db, "db_path", blocker / "chat.db")
    monkeypatch.setattr(db, "_ready_key", None)
    with pytest.raises(db.DatabaseUnavailable):
        db.list_conversations()
    assert db.check_database() is False


# ---------------------------------------------------------------------------
# Archive, rename and upgrading an older database
# ---------------------------------------------------------------------------
import sqlite3
from datetime import datetime, timedelta, timezone


def test_archive_restore_and_listing():
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "hello")
    assert db.archive_conversation(sid) is True
    assert db.archive_conversation(sid) is False  # already archived
    assert db.list_conversations() == []
    archived = db.list_archived_conversations()
    assert [a["session_id"] for a in archived] == [sid]
    assert db.get_archive_status(sid)["delete_at"] > db.get_archive_status(sid)["archived_at"]
    assert db.restore_conversation(sid) is True
    assert db.restore_conversation(sid) is False
    assert db.get_archive_status(sid) is None


def test_writing_in_an_archived_chat_restores_it():
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "hello")
    db.archive_conversation(sid)
    db.add_chat_message(sid, "assistant", "I'm back")
    assert [c["session_id"] for c in db.list_conversations()] == [sid]


def test_purge_removes_only_expired_archives_and_their_messages():
    old, recent = str(uuid4()), str(uuid4())
    for sid in (old, recent):
        db.add_chat_message(sid, "user", "hi")
        db.archive_conversation(sid)
    with db._connect() as conn:
        conn.execute(
            "UPDATE conversations SET archived_at = ? WHERE id = ?",
            ((datetime.now(timezone.utc) - timedelta(days=31)).isoformat(), old),
        )
    assert db.purge_expired_archives() == 1
    assert db.get_conversation_messages(old) == []
    assert len(db.get_conversation_messages(recent)) == 1


def test_rename_changes_the_title():
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "hello")
    assert db.rename_conversation(sid, "Order help") is True
    assert db.list_conversations()[0]["title"] == "Order help"
    assert db.rename_conversation(str(uuid4()), "x") is False


def test_an_older_database_without_the_archive_column_is_upgraded(tmp_path, monkeypatch):
    old_db = tmp_path / "old.db"
    conn = sqlite3.connect(old_db)
    conn.executescript(
        """CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'New Chat',
               created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
           CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL,
               role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
           INSERT INTO conversations VALUES ('old-chat', 'Old chat', '2026-01-01', '2026-01-01');"""
    )
    conn.commit()
    conn.close()
    monkeypatch.setattr(db, "db_path", old_db)
    assert [c["session_id"] for c in db.list_conversations()] == ["old-chat"]  # upgraded on first use
    assert db.archive_conversation("old-chat") is True
