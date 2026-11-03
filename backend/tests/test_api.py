import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.main import app
from app.schemas.ingestion import IngestionResult
from app.services import database_service as db

FAKE_RESULT = IngestionResult(
    intent="order_tracking",
    risk_profile="medium",
    priority="medium",
    requires_action=True,
    summary="User asks where their order is.",
)


def fake_classify(message, usage=None):
    if usage is not None:
        usage.update(input_tokens=300, output_tokens=40, estimated=False)
    return FAKE_RESULT.model_copy(deep=True)


def fake_stream_text(*pieces):
    def fake_stream(result, history=None, current_message=None, usage=None):
        yield from pieces
        if usage is not None:
            usage.update(input_tokens=500, output_tokens=60, estimated=False)

    return fake_stream


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "db_path", tmp_path / "test.db")
    with TestClient(app) as test_client:  # runs startup, which creates the tables
        yield test_client


def test_root_does_not_expose_the_api(client):
    body = client.get("/").json()
    assert body == {"service": "Indigo.ai API", "status": "running"}
    assert "/api/" not in str(body)


def test_health_reports_status_without_secrets(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database_ok"] is True
    assert isinstance(body["groq_api_key_configured"], bool)
    assert "gsk_" not in response.text


def test_conversations_start_empty_then_list_saved_chat(client):
    assert client.get("/api/conversations").json() == {"items": []}

    session_id = str(uuid4())
    db.add_chat_message(session_id, "user", "Where is my order?")
    items = client.get("/api/conversations").json()["items"]
    assert [item["session_id"] for item in items] == [session_id]

    messages = client.get(f"/api/conversations/{session_id}/messages").json()["items"]
    assert messages[0]["content"] == "Where is my order?"


def test_invalid_conversation_id_is_rejected(client):
    assert client.get("/api/conversations/not-a-uuid/messages").status_code == 400


@pytest.mark.parametrize(
    "body",
    [
        {"message": "   "},
        {"message": "hi", "session_id": "not-a-uuid"},
        {"message": "hi", "extra": "field"},
        {},
    ],
)
def test_analyze_rejects_bad_input_before_calling_the_llm(client, body):
    assert client.post("/api/analyze", json=body).status_code == 422
    assert client.post("/api/analyze/stream", json=body).status_code == 422


def read_events(response):
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def test_stream_sends_analysis_then_tokens_then_done_and_saves_chat(client, monkeypatch):
    monkeypatch.setattr(main, "analyze_message", fake_classify)
    monkeypatch.setattr(main, "stream_response", fake_stream_text("Let me ", "help ", "you."))

    response = client.post("/api/analyze/stream", json={"message": "Where is my order?"})
    assert response.status_code == 200
    events = read_events(response)

    assert [event["type"] for event in events] == ["analysis", "token", "token", "token", "done"]
    assert events[0]["intent"] == "order_tracking"
    usage = events[-1]["token_usage"]
    assert (usage["input_tokens"], usage["output_tokens"]) == (800, 100)  # both LLM calls added up
    assert usage["classification"]["input_tokens"] == 300
    assert usage["reply"]["output_tokens"] == 60
    assert usage["estimated"] is False
    session_id = events[-1]["session_id"]
    assert events[0]["session_id"] == session_id

    saved = client.get(f"/api/conversations/{session_id}/messages").json()["items"]
    assert [(m["role"], m["content"]) for m in saved] == [
        ("user", "Where is my order?"),
        ("assistant", "Let me help you."),
    ]


def test_incognito_stream_saves_nothing_and_uses_history_from_the_browser(client, monkeypatch):
    seen = {}

    def fake_stream(result, history=None, current_message=None, usage=None):
        seen["history"] = history
        yield "Sure."

    monkeypatch.setattr(main, "analyze_message", fake_classify)
    monkeypatch.setattr(main, "stream_response", fake_stream)

    body = {
        "message": "What about the second one?",
        "incognito": True,
        "history": [
            {"role": "user", "content": "I have two orders."},
            {"role": "assistant", "content": "Which one should I look at?"},
        ],
    }
    events = read_events(client.post("/api/analyze/stream", json=body))

    assert events[-1]["type"] == "done"
    assert seen["history"] == body["history"]
    assert client.get("/api/conversations").json() == {"items": []}
    assert client.get(f"/api/conversations/{events[0]['session_id']}/messages").json()["items"] == []


def test_incognito_non_stream_saves_nothing(client, monkeypatch):
    def fake_generate(result, history=None, current_message=None, usage=None):
        usage.update(input_tokens=500, output_tokens=60, estimated=False)
        return "Sure."

    monkeypatch.setattr(main, "analyze_message", fake_classify)
    monkeypatch.setattr(main, "generate_response", fake_generate)

    response = client.post("/api/analyze", json={"message": "Hi", "incognito": True})
    assert response.status_code == 200
    assert response.json()["token_usage"]["output_tokens"] == 100
    assert client.get("/api/conversations").json() == {"items": []}


def test_rename_conversation(client):
    session_id = str(uuid4())
    db.add_chat_message(session_id, "user", "Where is my order?")

    response = client.patch(f"/api/conversations/{session_id}", json={"title": "  Order   help  "})
    assert response.status_code == 200
    assert client.get("/api/conversations").json()["items"][0]["title"] == "Order help"

    assert client.patch(f"/api/conversations/{session_id}", json={"title": "   "}).status_code == 422
    assert client.patch(f"/api/conversations/{uuid4()}", json={"title": "x"}).status_code == 404


def test_delete_conversation_removes_its_messages(client):
    session_id = str(uuid4())
    db.add_chat_message(session_id, "user", "Where is my order?")
    db.add_chat_message(session_id, "assistant", "Let me help.")

    assert client.delete(f"/api/conversations/{session_id}").status_code == 204
    assert client.get("/api/conversations").json() == {"items": []}
    assert client.get(f"/api/conversations/{session_id}/messages").json()["items"] == []
    assert client.delete(f"/api/conversations/{session_id}").status_code == 404


def test_history_is_limited_to_12_messages(client):
    history = [{"role": "user", "content": "hi"}] * 13
    response = client.post("/api/analyze/stream", json={"message": "Hi", "incognito": True, "history": history})
    assert response.status_code == 422


def test_stream_reports_error_and_saves_nothing_when_writing_fails(client, monkeypatch):
    def broken_stream(*args, **kwargs):
        yield "Partial "
        raise RuntimeError("connection lost")

    monkeypatch.setattr(main, "analyze_message", fake_classify)
    monkeypatch.setattr(main, "stream_response", broken_stream)

    events = read_events(client.post("/api/analyze/stream", json={"message": "Where is my order?"}))
    assert events[-1]["type"] == "error"
    session_id = events[0]["session_id"]
    assert client.get(f"/api/conversations/{session_id}/messages").json()["items"] == []


def test_archive_hides_chat_and_restore_brings_it_back(client):
    session_id = str(uuid4())
    db.add_chat_message(session_id, "user", "Where is my order?")

    archived = client.post(f"/api/conversations/{session_id}/archive")
    assert archived.status_code == 200
    assert "delete_at" in archived.json()
    assert client.get("/api/conversations").json() == {"items": []}

    archive = client.get("/api/conversations/archived").json()
    assert archive["retention_days"] == 30
    assert [item["session_id"] for item in archive["items"]] == [session_id]
    assert client.get(f"/api/conversations/{session_id}/messages").json()["archive"] is not None

    assert client.post(f"/api/conversations/{session_id}/restore").status_code == 200
    assert [item["session_id"] for item in client.get("/api/conversations").json()["items"]] == [session_id]
    assert client.get("/api/conversations/archived").json()["items"] == []
    assert client.get(f"/api/conversations/{session_id}/messages").json()["archive"] is None
    assert client.post(f"/api/conversations/{session_id}/restore").status_code == 404


def test_archived_chats_are_deleted_after_30_days(client):
    old, recent = str(uuid4()), str(uuid4())
    for session_id in (old, recent):
        db.add_chat_message(session_id, "user", "hello")
        client.post(f"/api/conversations/{session_id}/archive")

    # Pretend `old` was archived 31 days ago.
    with db._connect() as conn:
        conn.execute(
            "UPDATE conversations SET archived_at = ? WHERE id = ?",
            ((datetime.now(timezone.utc) - timedelta(days=31)).isoformat(), old),
        )

    items = client.get("/api/conversations/archived").json()["items"]
    assert [item["session_id"] for item in items] == [recent]
    assert client.get(f"/api/conversations/{old}/messages").json()["items"] == []  # messages gone too


def test_writing_in_an_archived_chat_restores_it(client):
    session_id = str(uuid4())
    db.add_chat_message(session_id, "user", "hello")
    client.post(f"/api/conversations/{session_id}/archive")

    db.add_chat_message(session_id, "user", "I'm back")
    assert [item["session_id"] for item in client.get("/api/conversations").json()["items"]] == [session_id]


def test_archive_unknown_chat_returns_404(client):
    assert client.post(f"/api/conversations/{uuid4()}/archive").status_code == 404