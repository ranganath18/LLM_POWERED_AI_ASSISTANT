# LLM POWERED AI ASSISTANT

An intent-based AI response generator for customer support.

A user types a question. The backend first **detects the intent** and validates it against a strict schema (Week 1), then asks an LLM to **write a context-aware reply in Markdown** (Week 2). The React chat UI shows the reply with formatting.

```
User question → Intent detection → LLM processing → Markdown response → React chat UI
```

## Features

- Intent detection with validated, structured output (Groq + Instructor + Pydantic)
- Context-aware replies: the detected intent, priority, risk and summary are passed into the reply prompt
- Markdown replies rendered in React with `react-markdown`
- ChatGPT-style interface: sidebar with saved chats, message thread, chat bar, dark/light mode
- Loading indicator, error messages and a Retry button

## Tech stack

| Part | Technology |
|------|------------|
| Backend | Python, FastAPI, Pydantic, Instructor, Groq SDK |
| Frontend | React, Vite, react-markdown, remark-gfm |
| LLM provider | Groq |

## Project structure

```
prompt_gate_AI/
├── backend/     FastAPI server and LLM logic   (see backend/README_BACKEND.md)
├── frontend/    React chat interface           (see frontend/README_FRONTEND.md)
└── README.md
```

## Quick start

You need Python 3.11+, Node.js (LTS) and a Groq API key.

**1. Backend** (terminal 1)

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy env.example .env
```

Open `backend\.env` and paste your Groq key, then start the server:

```cmd
python -m uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (terminal 2)

```cmd
cd frontend
npm install
npm run dev
```

Open the address that `npm run dev` prints, usually `http://localhost:5173`.

## Security notes

- Never commit `backend/.env`. It holds your API key and is listed in `.gitignore`.
- The Groq key stays on the backend. The frontend never sees it.
- If a key is ever pushed to GitHub, delete it in the Groq console and create a new one.

## Roadmap

- Week 1: Enterprise structured ingestion firewall (intent detection and schema validation)
- Week 2: LLM integration and response generation (this version)
