from uuid import uuid4

import pytest

from app.services import database_service as db


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "db_path", tmp_path / "test.db")
    db.initialize_database()


def test_messages_are_saved_and_returned_in_order():
    session_id = str(uuid4())
    db.add_chat_message(session_id, "user", "Where is my order?")
    db.add_chat_message(session_id, "assistant", "Let me explain how to track it.")

    assert db.get_chat_history(session_id) == [
        {"role": "user", "content": "Where is my order?"},
        {"role": "assistant", "content": "Let me explain how to track it."},
    ]
    messages = db.get_conversation_messages(session_id)
    assert [m["role"] for m in messages] == ["user", "assistant"]


def test_history_is_limited_to_most_recent_messages():
    session_id = str(uuid4())
    for i in range(db.MAX_HISTORY_MESSAGES + 4):
        db.add_chat_message(session_id, "user", f"message {i}")

    history = db.get_chat_history(session_id)
    assert len(history) == db.MAX_HISTORY_MESSAGES
    assert history[-1]["content"] == f"message {db.MAX_HISTORY_MESSAGES + 3}"


def test_conversation_title_comes_from_first_user_message():
    session_id = str(uuid4())
    db.ensure_conversation(session_id)
    db.add_chat_message(session_id, "user", "My payment was deducted twice")
    db.add_chat_message(session_id, "user", "Any update?")

    [conversation] = db.list_conversations()
    assert conversation["session_id"] == session_id
    assert conversation["title"] == "My payment was deducted twice"
    assert conversation["preview"] == "Any update?"


def test_invalid_role_is_rejected():
    with pytest.raises(Exception):
        db.add_chat_message(str(uuid4()), "system", "not allowed")
