# Backend

The Python part of the project. For each message it:

1. **Classifies** it with an LLM and validates the result with Pydantic (Week 1)
2. **Writes an answer** with a second LLM call (Week 2)
3. **Remembers** the conversation in a SQLite database (Week 3)

All commands below are run from the `backend` folder with the virtual environment active (your prompt shows `(.venv)`).

## Setup (one time)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
notepad .env
```

`requirements.txt` is what the app needs (and what Render installs). `requirements-dev.txt` adds the test tools (`pytest`, `httpx`). Versions are pinned so every install matches.

Your `.env` should contain:

```env
GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
# Optional: where to store chat history (default: data/chat.db)
# SQLITE_PATH=data/chat.db
```

| Variable | Required | Meaning |
|---|---|---|
| `GROQ_API_KEY` | Yes | Your Groq key |
| `GROQ_MODEL` | No | Groq model; defaults to `openai/gpt-oss-120b` |
| `ALLOWED_ORIGINS` | No locally, **yes on Render** | Comma-separated websites allowed to call the API from a browser (CORS). Defaults to the Vite dev server. On Render, set it to your Vercel URL. |
| `DATABASE_URL` | No locally, **recommended on Render** | PostgreSQL connection string (e.g. Neon). When set, chats are stored in PostgreSQL; when empty, in the SQLite file below. |
| `SQLITE_PATH` | No | Where the SQLite file goes when `DATABASE_URL` is empty. Relative paths start from `backend/`. |

- No quotes and no spaces around `=`.
- Save it as `.env`, not `.env.txt`.
- Never share it or push it to GitHub (it's already in `.gitignore`).

If `Activate.ps1` is blocked, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

`--reload` restarts the server automatically when you save a Python file. On startup the server creates `data/chat.db` and its tables if they don't exist.

| Open this | What you get |
|---|---|
| http://127.0.0.1:8000/ | `{"service": "Indigo.ai API", "status": "running"}` |
| http://127.0.0.1:8000/health | Status: `database_ok`, `groq_api_key_configured`, `model` |
| http://127.0.0.1:8000/docs | Interactive page to try every endpoint |
| http://127.0.0.1:8000/api/conversations | Your saved conversations |

Stop the server with `Ctrl + C`.

## How the code works, file by file

Read them in this order; each builds on the one before.

### 1. `app/config.py`: settings

Loads `GROQ_API_KEY`, `GROQ_MODEL`, `SQLITE_PATH` and `ALLOWED_ORIGINS` from your `.env` file (or from Render's environment variables). A relative `SQLITE_PATH` is resolved from the `backend` folder, so the database lands in the same place no matter where you start the server.

### 2. `app/schemas/ingestion.py`: Week 1 data rules

Defines what valid data looks like, using Pydantic:

- **`IngestionRequest`**: what the frontend sends.
  - `message`: 1–5000 characters, trimmed; whitespace-only is rejected.
  - `session_id` (optional): which conversation this message belongs to. Leave it out to start a new one.
- **`IngestionResult`**: what the LLM must return. Only these values are allowed:

| Field | Allowed values |
|---|---|
| `intent` | `greeting`, `order_tracking`, `payment_issue`, `current_time`, `general_question`, `unknown` |
| `risk_profile` | `low`, `medium`, `high`, `unknown` |
| `priority` | `low`, `medium`, `high` |
| `requires_action` | `true` / `false` |
| `summary` | text, 1–500 characters |

`Literal[...]` is what restricts a field to a fixed list. `extra="forbid"` rejects any field we didn't define.

### 3. `app/services/llm_service.py`: Week 1, classify the message

- A **system prompt** tells the LLM what each intent and risk level means.
- **Instructor** wraps the Groq client so the reply must fit `IngestionResult`.
- `temperature=0` gives consistent answers; `max_retries=2` lets Instructor ask again if the reply fails validation.

### 4. `app/utils/token_counter.py`: estimate tokens

Counts roughly how many tokens the message is, using `tiktoken`. It's an estimate only, not Groq's real billing number.

### 5. `app/schemas/assistant.py`: Week 2 data rules

**`AssistantResult`** = everything in `IngestionResult` **plus**:

- `response_markdown`: the written answer
- `session_id`: the conversation id (new or existing)

It inherits from `IngestionResult`, so we don't repeat the fields.

### 6. `app/services/database_service.py`: Week 3, chat history (PostgreSQL or SQLite)

- **`DATABASE_URL` set** (production, e.g. a free Neon database): PostgreSQL via `psycopg`, with a small connection pool. Prepared statements are turned off because Neon's pooled endpoint doesn't support them, and connections are checked before use because Neon suspends idle databases.
- **`DATABASE_URL` empty** (local development, tests): Python's built-in `sqlite3` and a file, with nothing to install.

The SQL is written once with `?` placeholders and converted to `%s` for PostgreSQL. `/health` reports which one is in use (`"database": "postgres"` or `"sqlite"`). Tests always use SQLite (see `tests/conftest.py`), so they never touch your real database. Two tables (see `sql/schema.sql`):

| Table | Columns |
|---|---|
| `conversations` | `id` (the session id), `title`, `created_at`, `updated_at` |
| `messages` | `id`, `conversation_id`, `role` (`user`/`assistant`), `content`, `created_at` |

| Function | What it does |
|---|---|
| `initialize_database()` | Creates the file and tables on startup |
| `ensure_conversation(id, title)` | Creates the conversation row if it's new |
| `add_chat_message(id, role, content)` | Saves one message; the first user message becomes the title |
| `get_chat_history(id)` | Last **12** messages, oldest first: the memory sent to the LLM |
| `list_conversations()` | Newest conversations first, for the sidebar |
| `get_conversation_messages(id)` | Every message in one conversation, for reopening a chat |

Every query uses `?` placeholders, never string formatting, which protects against SQL injection.

### 7. `app/services/response_service.py`: Week 2, write the answer

- Takes the **validated** Week 1 result, the **recent history** and the **current message**.
- Sends them to the LLM with a support-assistant prompt: be clear, use earlier messages to understand follow-ups like "that order", never ask for passwords/OTPs, don't pretend to take actions.
- Returns the answer as Markdown. `temperature=0.3` lets the wording vary a little so it sounds natural.

### 8. `app/main.py`: the API

Connects everything:

```text
POST /api/analyze
  → IngestionRequest checks the message (and session_id, if sent)
  → no session_id? create a new one
  → analyze_message()        (Week 1)
  → estimate_tokens()
  → get_chat_history()       (Week 3)
  → generate_response()      (Week 2, with history)
  → add_chat_message() ×2    (Week 3: save user + assistant messages)
  → returns AssistantResult
```

Any error in the LLM calls becomes HTTP `502`.

`main.py` also:

- creates the database tables once at startup (the `lifespan` function)
- only lets the websites in `ALLOWED_ORIGINS` call the API from a browser (CORS)
- serves `/` (a short "running" message, without listing the API) and `/health` (status check for Render and the frontend)

## API reference

| Method | Path | What it does |
|---|---|---|
| `GET` | `/` | Simple "running" status (doesn't list the API) |
| `GET` | `/health` | Status check (database, API key configured, model) |
| `GET` | `/docs` | Interactive documentation (generated by FastAPI) |
| `POST` | `/api/analyze` | Send a message, get intent analysis + answer |
| `GET` | `/api/conversations` | Recent conversations |
| `POST` | `/api/analyze/stream` | Same, but streams the answer (NDJSON); supports incognito |
| `GET` | `/api/conversations/{session_id}/messages` | Messages in one conversation |
| `PATCH` | `/api/conversations/{session_id}` | Rename a conversation |
| `POST` | `/api/conversations/{session_id}/archive` | Move a conversation to the archive |
| `POST` | `/api/conversations/{session_id}/restore` | Bring an archived conversation back |
| `GET` | `/api/conversations/archived` | Archived conversations + when each will be deleted |
| `DELETE` | `/api/conversations/{session_id}` | Delete a conversation and its messages permanently |

### `POST /api/analyze/stream`

Same request as `/api/analyze`. The response arrives as **one JSON object per line** (NDJSON) while the AI writes:

```text
{"type": "analysis", "intent": "order_tracking", "risk_profile": "medium", ..., "session_id": "c2e1…"}
{"type": "token", "text": "## Tracking"}
{"type": "token", "text": " your order"}
...
{"type": "done", "session_id": "c2e1…", "token_usage": {"input_tokens": 1074, "output_tokens": 264, "estimated": false,
  "classification": {"input_tokens": 791, "output_tokens": 165, "estimated": false},
  "reply": {"input_tokens": 283, "output_tokens": 99, "estimated": false}}}
```

- If writing fails midway, the last line is `{"type": "error", "detail": "..."}` instead of `done`.
- The conversation is saved only after `done`, so a stopped or failed reply is never saved.
- `token_usage` is Groq's real count for **both** LLM calls (intent detection + reply). `estimated: true` means Groq didn't report it and it was counted locally with `tiktoken`.

### Incognito mode

Add `"incognito": true` to `/api/analyze` or `/api/analyze/stream` and **nothing is written to the database**: no conversation, no messages. Because the server keeps no history, the browser sends the recent messages itself:

```json
{
  "message": "What about the second one?",
  "incognito": true,
  "history": [
    { "role": "user", "content": "I have two orders." },
    { "role": "assistant", "content": "Which one should I look at?" }
  ]
}
```

`history` allows at most 12 messages. The message is still sent to Groq to generate the answer; incognito only controls what *this app* stores.

### `PATCH /api/conversations/{session_id}`

```json
{ "title": "Order help" }
```

Returns `{ "session_id": "...", "title": "Order help" }`; `404` if the conversation doesn't exist.

### Archive (30-day retention)

- `POST /api/conversations/{id}/archive` hides the chat from `/api/conversations` and returns `{ "archived_at", "delete_at" }`.
- `GET /api/conversations/archived` returns `{ "retention_days": 30, "items": [{ "session_id", "title", "archived_at", "delete_at" }] }`.
- `POST /api/conversations/{id}/restore` brings it back.
- `GET /api/conversations/{id}/messages` includes `"archive": { "archived_at", "delete_at" }` (or `null`), so the app can show a banner.
- Sending a new message in an archived chat restores it automatically.
- **Automatic clean-up:** chats archived more than `ARCHIVE_RETENTION_DAYS` (default 30) ago are deleted, with their messages, at startup and every time chats are listed. No cron job is needed.

In the app, both **Archive** and **Delete** in a chat's ⋯ menu move it to the archive (with an Undo button); **Delete forever** in the archive removes it immediately.

### `DELETE /api/conversations/{session_id}`

Deletes the conversation and all its messages. Returns `204`, or `404` if it doesn't exist.

### `GET /`

```json
{ "service": "Indigo.ai API", "status": "running" }
```

### `GET /health`

```json
{
  "status": "ok",
  "message": "Indigo.ai API is running",
  "database": "sqlite",
  "database_ok": true,
  "groq_api_key_configured": true,
  "model": "openai/gpt-oss-120b"
}
```

- Returns `200` when the database works, `503` with `"status": "error"` when it doesn't. Render uses this to decide whether a deploy is healthy.
- `groq_api_key_configured` only says **whether** a key is set; the key itself is never returned.
- It doesn't call the LLM, so it's fast and free to call.

### `POST /api/analyze`

Start a new conversation (no `session_id`):

```json
{ "message": "Where is my order?" }
```

Continue it (send back the `session_id` you received):

```json
{ "message": "It was placed last Monday", "session_id": "c2e10ce1-98c4-4e7a-9d7d-be6712af88f3" }
```

Response (wording varies):

```json
{
  "intent": "order_tracking",
  "risk_profile": "medium",
  "priority": "medium",
  "requires_action": true,
  "summary": "User is asking about the status of their order.",
  "token_metadata": { "estimated_input_tokens": 5, "note": "Estimated locally; may differ from provider token counts." },
  "session_id": "c2e10ce1-98c4-4e7a-9d7d-be6712af88f3",
  "response_markdown": "## Tracking your order\n\n- Check the confirmation email...\n"
}
```

### `GET /api/conversations`

The 30 most recent conversations:

```json
{ "items": [ { "session_id": "c2e1…", "title": "Where is my order?", "updated_at": "2026-10-24T07:30:12+00:00", "preview": "It was placed last Monday" } ] }
```

### `GET /api/conversations/{session_id}/messages`

Every message in one conversation, oldest first:

```json
{ "session_id": "c2e1…", "items": [ { "role": "user", "content": "Where is my order?", "created_at": "…" } ] }
```

### Status codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | The conversation id in the URL isn't a valid UUID |
| `422` | Bad input (empty message, too long, invalid `session_id`, or extra fields) |
| `502` | The LLM call failed (see troubleshooting) |
| `503` | `/health` only: the database isn't working |

Try it from PowerShell without the frontend:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/analyze `
  -ContentType "application/json" `
  -Body '{"message":"Where is my order?"}'
```

## Looking inside the database

The file is `backend/data/chat.db`.

- **VS Code:** install the **SQLite Viewer** extension and click the file.
- **Terminal** (works while the server is running):

  ```powershell
  python -c "import sqlite3; c=sqlite3.connect('data/chat.db'); [print(r) for r in c.execute('SELECT conversation_id, role, substr(content,1,60) FROM messages ORDER BY id')]"
  ```

- **Start fresh:** stop the server and delete the `data` folder.

## Tests

```powershell
pytest -q
```

Expected: `27 passed`.

| File | Checks |
|---|---|
| `tests/test_ingestion.py` | Week 1 Pydantic rules (trimming, blank messages, invalid intent, valid data) |
| `tests/test_database.py` | Week 3 SQLite storage (order of messages, 12-message limit, titles, invalid roles) using a temporary database |
| `tests/test_api.py` | The endpoints: `/`, `/health` (no secrets leaked), conversations, rename/delete, archive/restore/30-day purge, invalid ids, bad input, streaming (event order, token counts, saving, errors) and incognito (nothing saved) |

None of them call the LLM, so they work without an API key or internet.

## Troubleshooting

### `502 The AI request failed`

The API hides the real reason, so call the Week 1 service directly to see it:

```powershell
python -c "from app.services.llm_service import analyze_message; print(analyze_message('Hi'))"
```

The server terminal also prints the error after `Request failed for session ...`.

| Error you see | Meaning | Fix |
|---|---|---|
| `401` / invalid API key | Key is wrong or expired | Fix `GROQ_API_KEY` in `.env` |
| `404 model_not_found` | That model doesn't exist anymore | Pick one from the list below and set `GROQ_MODEL` |
| `GROQ_API_KEY is missing` | `.env` not found | Make sure the file is `backend\.env`, not `.env.txt` |
| Connection / timeout | No internet or Groq is down | Check your connection |
| `database is locked` | Something else has the database open for writing | Close other programs using `chat.db` |

List the models your key can use:

```powershell
python -c "from groq import Groq; from app.config import GROQ_API_KEY; [print(m.id) for m in Groq(api_key=GROQ_API_KEY).models.list().data]"
```

Restart `uvicorn` after changing `.env`.

### Port 8000 already in use

An old server is still running. Press `Ctrl + C` in its terminal, or check what's using the port:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
```

## Deploying to Render

The full step-by-step guide (with Vercel) is in the [root README](../README.md#deploy-backend-on-render-frontend-on-vercel). The short version:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Environment | `GROQ_API_KEY`, `GROQ_MODEL`, `ALLOWED_ORIGINS` (your Vercel URL), `PYTHON_VERSION=3.12.10` |

Or use **New → Blueprint**, which reads `render.yaml` in the repo root.

- `--host 0.0.0.0 --port $PORT` is required: Render tells the app which port to use.
- On the free plan the disk is wiped on every deploy/restart, so **chat history resets**. Use a paid persistent disk and `SQLITE_PATH=/var/data/chat.db` to keep it.
- Check the deploy at `https://<your-service>.onrender.com/health`.

## Known limitations (good discussion topics)

- If Instructor runs out of retries, it raises `InstructorRetryException`, not `ValidationError`, so you get the generic 502 instead of the detailed validation message.
- The conversation row is created before the LLM is called, so a failed request can leave an empty conversation in the sidebar.
- `token_metadata` is part of the schema sent to the LLM in Week 1, so the model may fill it in; the code overwrites the count afterwards.
- A new Groq client and a new SQLite connection are created on every request. Simple, but not the fastest.
- There are no user accounts or rate limits: anyone who can reach the API can read every conversation and use your Groq quota. CORS only stops other *websites*; it doesn't stop scripts or `curl`.
- `app/services/conversation_service.py` is the old in-memory history from early Week 3 and is no longer used.
