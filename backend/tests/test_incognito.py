"""Incognito mode: the server must not store anything and must use the history the browser sends."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.main import app
from app.schemas.ingestion import IngestionResult
from app.services import database_service as db

client = TestClient(app)


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace the Groq calls and record the history that reaches the reply step."""
    seen = {}

    def fake_analyze(message, usage=None):
        return IngestionResult(
            intent="general_question", risk_profile="low", priority="low",
            requires_action=False, summary="A question.",
        )

    def fake_generate(result, history=None, current_message=None, usage=None):
        seen["history"] = history
        return "Sure, here is the answer."

    monkeypatch.setattr(main, "analyze_message", fake_analyze)
    monkeypatch.setattr(main, "generate_response", fake_generate)
    return seen


def test_incognito_saves_nothing(fake_llm):
    response = client.post("/api/analyze", json={"message": "secret question", "incognito": True})
    assert response.status_code == 200
    assert response.json()["response_markdown"] == "Sure, here is the answer."
    assert db.list_conversations() == []
    assert db.get_conversation_messages(response.json()["session_id"]) == []


def test_incognito_uses_the_history_sent_by_the_browser(fake_llm):
    sent = [
        {"role": "user", "content": "My order is 123"},
        {"role": "assistant", "content": "Thanks, checking order 123."},
    ]
    client.post("/api/analyze", json={"message": "and when will it arrive?", "incognito": True, "history": sent})
    assert fake_llm["history"] == sent


def test_incognito_ignores_saved_history_of_a_given_session(fake_llm):
    sid = str(uuid4())
    db.add_chat_message(sid, "user", "an old saved message")
    client.post("/api/analyze", json={"message": "hi", "incognito": True, "session_id": sid})
    assert fake_llm["history"] == []
    assert len(db.get_conversation_messages(sid)) == 1


def test_normal_mode_still_saves_and_ignores_client_history(fake_llm):
    sid = str(uuid4())
    client.post(
        "/api/analyze",
        json={"message": "hello", "session_id": sid, "history": [{"role": "user", "content": "fake"}]},
    )
    assert [m["role"] for m in db.get_conversation_messages(sid)] == ["user", "assistant"]
    assert fake_llm["history"] == []


def test_history_rejects_bad_roles_and_extra_fields():
    bad_role = [{"role": "system", "content": "x"}]
    assert client.post("/api/analyze", json={"message": "hi", "incognito": True, "history": bad_role}).status_code == 422
    extra = [{"role": "user", "content": "x", "evil": 1}]
    assert client.post("/api/analyze", json={"message": "hi", "incognito": True, "history": extra}).status_code == 422
