# IntentDesk AI

An intent-aware AI assistant for customer support.

For every message the backend first **detects the intent** and validates it against a strict schema, then asks an LLM to **write a context-aware reply in Markdown**, streamed to a React chat UI as it is generated.

```
User message → Intent detection (validated JSON) → LLM reply (streamed Markdown) → React chat UI
                                   ↘ saved to PostgreSQL / SQLite ↙
```

## Features

- **Structured intent detection**: intent, risk profile, priority, `requires_action` and a summary, validated with Pydantic (Groq + Instructor)
- **Context-aware replies**: the intent analysis and the last 12 messages are passed into the reply prompt
- **Streaming answers** over NDJSON, with a Stop button
- **Saved chats**: sidebar, search (`Ctrl/⌘ + K`), rename, archive and restore (archived chats are deleted after 30 days)
- **Incognito mode**: nothing is stored on the server; the browser keeps the history
- **Token usage and response time** shown per reply
- **Insights panel** with the detected intent, risk, priority and suggested follow-ups
- Markdown rendering with copyable code blocks, voice input, Markdown export, dark/light theme

## Tech stack

| Part | Technology |
|------|------------|
| Backend | Python 3.12, FastAPI, Pydantic, Instructor, Groq SDK, tiktoken |
| Database | PostgreSQL (Supabase) in production, SQLite locally; `psycopg` with a connection pool |
| Frontend | React 18, Vite, React Router, react-markdown, remark-gfm |
| LLM provider | Groq (default model: `openai/gpt-oss-120b`) |
| Hosting | Render (backend), Vercel (frontend) |

## Project structure

```
.
├── backend/                 FastAPI server and LLM logic  → backend/README.md
│   ├── app/                 config, schemas, services, utils, main.py
│   ├── sql/schema.sql       reference copy of the database schema
│   ├── tests/               pytest suite (no network or API key needed)
│   └── .env.example
├── frontend-react/          React chat interface          → frontend-react/README.md
│   └── .env.example
├── render.yaml              Render Blueprint for the backend
└── README.md
```

## Quick start

You need Python 3.11+, Node.js 18+ and a free [Groq API key](https://console.groq.com/keys).

**1. Backend** (terminal 1)

```bash
cd backend
python -m venv .venv
# Windows (PowerShell): .\.venv\Scripts\Activate.ps1
# macOS / Linux:        source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # Windows: copy .env.example .env
```

Open `backend/.env`, paste your Groq key, then start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (terminal 2)

```bash
cd frontend-react
npm install
npm run dev
```

Open the address `npm run dev` prints, usually `http://localhost:5173`. In development Vite proxies `/api` and `/health` to port 8000, so no CORS setup is needed.

## Configuration

Backend variables (`backend/.env`, or the Render dashboard in production):

| Variable | Required | Meaning |
|---|---|---|
| `GROQ_API_KEY` | Yes | Your Groq key |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-120b` |
| `ALLOWED_ORIGINS` | Yes in production | Comma-separated site URLs allowed to call the API (your Vercel URL) |
| `DATABASE_URL` | Recommended in production | PostgreSQL connection string. Empty → local SQLite file |
| `SQLITE_PATH` | No | SQLite file location (default `data/chat.db`) |
| `ARCHIVE_RETENTION_DAYS` | No | Days before archived chats are deleted (default 30) |

Frontend variable (`frontend-react/.env.local`, or Vercel project settings): `VITE_API_URL`, the backend URL without a trailing slash. Leave it unset locally.

## Tests

```bash
cd backend
pytest
```

The tests replace the LLM with a fake and use a temporary SQLite database, so they never call Groq or touch a real database.

## Deploy: backend on Render, frontend on Vercel

**Backend (Render)**

1. Render → **New → Blueprint** → select this repo. It reads `render.yaml`.
2. Fill in the values Render asks for: `GROQ_API_KEY`, `DATABASE_URL` (Supabase *Session pooler* string) and `ALLOWED_ORIGINS` (your Vercel URL, no trailing slash; you can set it after step 4).
3. Check `https://<your-service>.onrender.com/health`. It should report `"status": "ok"`.

**Frontend (Vercel)**

4. Vercel → **Add New → Project** → select this repo and set **Root Directory** to `frontend-react`.
5. Add the environment variable `VITE_API_URL` = your Render URL, then deploy.
6. Go back to Render and set `ALLOWED_ORIGINS` to the final Vercel URL.

Without `DATABASE_URL` the backend falls back to SQLite, which Render's free plan wipes on every deploy and restart. Always set it in production.

## Security notes

- Never commit `backend/.env`. It is listed in `.gitignore`.
- The Groq key stays on the backend; the browser never sees it.
- If a key is ever pushed to GitHub, revoke it in the Groq console and create a new one.
- **Known limitation:** there are no user accounts or rate limits yet. Anyone who can reach the API can list conversations and use your Groq quota. CORS only restricts other websites, not scripts. See "Planned" below.

## Roadmap

**Done**

- [x] Intent detection with validated, structured output
- [x] LLM reply generation with conversation history
- [x] Persistent chat history (PostgreSQL / SQLite)
- [x] Deployment on Render and Vercel, health check, clean error handling
- [x] Streaming, archive/restore/rename, incognito mode, token usage

**Planned**

- [ ] User accounts or per-browser tokens, so chats are private
- [ ] Rate limiting on the API
- [ ] Use the detected intent and risk to route requests (for example, escalate high-risk messages)
- [ ] Ground answers in a knowledge base (RAG)
- [ ] Frontend tests and CI
