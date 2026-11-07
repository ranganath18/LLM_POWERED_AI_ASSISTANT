import json
import logging
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from app.config import ALLOWED_ORIGINS, ARCHIVE_RETENTION_DAYS, GROQ_API_KEY, GROQ_MODEL
from app.schemas.assistant import AssistantResult, TokenUsage
from app.schemas.ingestion import IngestionRequest, RenameRequest
from app.services.database_service import (
    DatabaseUnavailable,
    add_chat_message,
    archive_conversation,
    check_database,
    database_kind,
    delete_conversation,
    get_archive_status,
    get_chat_history,
    get_conversation_messages,
    initialize_database,
    list_archived_conversations,
    list_conversations,
    purge_expired_archives,
    rename_conversation,
    restore_conversation,
)
from app.services.llm_service import analyze_message
from app.services.response_service import generate_response, stream_response
from app.utils.token_counter import estimate_tokens

logger = logging.getLogger(__name__)

# Shown to end users. The real cause goes to the server log, never to the browser.
USER_ERROR = "The assistant couldn't answer right now. Please try again in a moment."
DB_ERROR = "The chat history service is temporarily unavailable. Please try again in a moment."


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts. If the database is unreachable we log it and
    # keep running: /health then reports 503, and the tables are created on first use.
    try:
        initialize_database()
        purge_expired_archives()
    except DatabaseUnavailable as exc:
        logger.error("Database not ready at startup: %s", exc.__cause__ or exc)
    yield


app = FastAPI(
    title="IntentDesk AI API",
    description="AI-powered message analysis and contextual assistance.",
    version="4.0.0",
    lifespan=lifespan,
)

# Only the websites listed in ALLOWED_ORIGINS (backend/.env locally, Render settings in
# production) may call this API from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(DatabaseUnavailable)
async def database_unavailable_handler(request: Request, exc: DatabaseUnavailable):
    return JSONResponse(status_code=503, content={"detail": DB_ERROR})


def _check_conversation_id(session_id: str) -> None:
    try:
        UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")


@app.get("/")
def root():
    """Public landing response: confirms the service is up without listing the API."""
    return {"service": app.title, "status": "running"}


@app.get("/health")
def health_check(response: Response):
    """Cheap check for Render and the frontend: never calls the LLM or returns secrets."""
    database_ok = check_database()
    if not database_ok:
        response.status_code = 503
    return {
        "status": "ok" if database_ok else "error",
        "message": "IntentDesk AI API is running",
        "database": database_kind(),
        "database_ok": database_ok,
        "groq_api_key_configured": bool(GROQ_API_KEY),  # true/false only, never the key
        "model": GROQ_MODEL,
    }


# ---------- Conversations (sidebar, archive, rename, delete) ----------


@app.get("/api/conversations")
def conversations():
    purge_expired_archives()  # the 30-day clean-up runs whenever chats are listed
    return {"items": list_conversations()}


@app.get("/api/conversations/archived")
def archived_conversations():
    purge_expired_archives()
    return {"retention_days": ARCHIVE_RETENTION_DAYS, "items": list_archived_conversations()}


@app.get("/api/conversations/{session_id}/messages")
def conversation_messages(session_id: str):
    _check_conversation_id(session_id)
    return {
        "session_id": session_id,
        "archive": get_archive_status(session_id),  # null unless the chat is archived
        "items": get_conversation_messages(session_id),
    }


@app.post("/api/conversations/{session_id}/archive")
def archive(session_id: str):
    _check_conversation_id(session_id)
    if not archive_conversation(session_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"session_id": session_id, **get_archive_status(session_id)}


@app.post("/api/conversations/{session_id}/restore")
def restore(session_id: str):
    _check_conversation_id(session_id)
    if not restore_conversation(session_id):
        raise HTTPException(status_code=404, detail="This chat isn't in the archive.")
    return {"session_id": session_id, "restored": True}


@app.patch("/api/conversations/{session_id}")
def rename(session_id: str, body: RenameRequest):
    _check_conversation_id(session_id)
    if not rename_conversation(session_id, body.title):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"session_id": session_id, "title": body.title}


@app.delete("/api/conversations/{session_id}", status_code=204)
def delete(session_id: str):
    _check_conversation_id(session_id)
    if not delete_conversation(session_id):
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return Response(status_code=204)


# ---------- Chat (normal, incognito, streaming) ----------


def _read_request(request: IngestionRequest) -> tuple[str, str]:
    """The cleaned message and a valid session id (new one if the browser sent none)."""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")
    session_id = request.session_id or str(uuid4())
    try:
        UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="session_id must be a valid UUID.")
    return message, session_id


def _classify_and_load_history(request: IngestionRequest, message: str, session_id: str, usage: dict):
    """Classify the message, and load the history to send to the LLM.

    Normal mode reads history from the database. Incognito mode never touches the
    database: the browser sends the recent messages along with each request instead.
    `usage` is filled with the classification call's token counts.
    """
    result = analyze_message(message, usage=usage)
    result.token_metadata.estimated_input_tokens = estimate_tokens(message)
    if request.incognito:
        history = [turn.model_dump() for turn in request.history]
    else:
        history = get_chat_history(session_id)
    return result, history


def _save_exchange(request: IngestionRequest, session_id: str, message: str, answer: str) -> None:
    if request.incognito:
        return  # incognito: nothing is stored
    # Saved only after the LLM succeeded, so a failed or stopped reply leaves no half-saved turn.
    add_chat_message(session_id, "user", message)
    add_chat_message(session_id, "assistant", answer)


@app.post("/api/analyze", response_model=AssistantResult)
def analyze(request: IngestionRequest):
    message, session_id = _read_request(request)
    classify_usage, reply_usage = {}, {}
    try:
        result, history = _classify_and_load_history(request, message, session_id, classify_usage)
        response_markdown = generate_response(
            result, history=history, current_message=message, usage=reply_usage
        )
        _save_exchange(request, session_id, message, response_markdown)
        return AssistantResult(
            **result.model_dump(),
            session_id=session_id,
            response_markdown=response_markdown,
            token_usage=TokenUsage.combine(classify_usage, reply_usage),
        )
    except DatabaseUnavailable:
        raise  # handled above -> clean 503
    except ValidationError as exc:
        logger.error("Validation failed for session %s: %s", session_id, exc)
        raise HTTPException(status_code=502, detail=USER_ERROR) from exc
    except Exception as exc:
        logger.error("Request failed for session %s: %s", session_id, exc)
        raise HTTPException(status_code=502, detail=USER_ERROR) from exc


def _event(payload: dict) -> str:
    """One streaming event = one line of JSON (NDJSON)."""
    return json.dumps(payload, ensure_ascii=False) + "\n"


@app.post("/api/analyze/stream")
def analyze_stream(request: IngestionRequest):
    """Same as /api/analyze, but the answer arrives piece by piece (like ChatGPT).

    Events, one JSON object per line:
      {"type": "analysis", ...intent fields..., "session_id": "..."}   first, once
      {"type": "token", "text": "..."}                                    many times
      {"type": "done", "session_id": "...", "token_usage": {...}}         last, once
      {"type": "error", "detail": "..."}                                  instead of "done" if writing fails
    """
    message, session_id = _read_request(request)
    classify_usage, reply_usage = {}, {}

    # Classification runs before streaming starts, so its errors are normal HTTP errors.
    try:
        result, history = _classify_and_load_history(request, message, session_id, classify_usage)
    except DatabaseUnavailable:
        raise
    except Exception as exc:
        logger.error("Classification failed for session %s: %s", session_id, exc)
        raise HTTPException(status_code=502, detail=USER_ERROR) from exc

    def events():
        yield _event({"type": "analysis", **result.model_dump(), "session_id": session_id})
        parts = []
        try:
            for text in stream_response(result, history=history, current_message=message, usage=reply_usage):
                parts.append(text)
                yield _event({"type": "token", "text": text})
            answer = "".join(parts).strip()
            if not answer:
                raise ValueError("The LLM returned an empty response.")
            # Saved only after the full answer arrives; a stopped reply is not saved.
            _save_exchange(request, session_id, message, answer)
            token_usage = TokenUsage.combine(classify_usage, reply_usage)
            yield _event({"type": "done", "session_id": session_id, "token_usage": token_usage.model_dump()})
        except DatabaseUnavailable:
            yield _event({"type": "error", "detail": DB_ERROR})
        except Exception as exc:
            logger.error("Streaming failed for session %s: %s", session_id, exc)
            yield _event({"type": "error", "detail": USER_ERROR})

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
