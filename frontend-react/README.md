# Frontend (React + Vite)

The **Indigo.ai** web app: a landing page and a chat workspace, built with **React** and **Vite** in plain **JavaScript**. It talks to the FastAPI backend in `../backend`.

## Run it

You need **Node.js 18+** (check with `node --version`) and the backend running on port 8000.

```powershell
cd frontend-react
npm install        # first time only
npm run dev
```

Open http://localhost:5173

| Page | URL |
|---|---|
| Landing page | http://localhost:5173/ |
| Documentation (for users) | http://localhost:5173/documentation |
| New chat | http://localhost:5173/chat |
| A saved chat | http://localhost:5173/chat/<session_id> |

### Chat features

| Feature | Where |
|---|---|
| New chat, search chats (`Ctrl/⌘ + K`), chats grouped by Today / Yesterday / Previous 7 days | Left sidebar |
| Backend status and light/dark mode | Card at the bottom of the sidebar |
| Current model (from `/health`) with a status dot | Chip at the top left |
| Message Insights: intent, risk, priority, tokens, suggested follow-ups | Chart icon, top right |
| Copy a link to the current chat | Link icon, top right |
| Download the chat as a Markdown file | **Export chat**, top right |
| Close the insights panel or the mobile menu | `Esc` |
| Replies stream in word by word; **Stop** (■) ends a reply early | Send button while the AI is writing |
| Input/output tokens for each reply (hover for the breakdown) | Under each answer, and in Message Insights |
| Voice input: click the mic, speak, click again to stop | Mic button in the message box (Chrome, Edge, Safari) |
| Rename, archive or delete a chat | **⋯** next to a chat in the sidebar (or double-click to rename) |
| Restore archived/deleted chats (kept 30 days, then removed for good) | **Archived chats** at the bottom of the sidebar |
| Incognito: a full-screen chat that is never saved | **Incognito** button, top right |

Stop it with `Ctrl + C`.

## How it connects to the backend

`vite.config.js` has a **proxy**: when the app calls `/api/...` or `/health`, Vite forwards the request to `http://127.0.0.1:8000`. The browser only ever talks to port 5173, so there are no CORS problems.

All requests are in **`src/lib/api.js`**:

| Function | Backend endpoint | Used for |
|---|---|---|
| `api.health()` | `GET /health` | Green/red status dot |
| `api.listConversations()` | `GET /api/conversations` | Sidebar "Recent conversations" |
| `api.getMessages(id)` | `GET /api/conversations/{id}/messages` | Opening a saved chat |
| `api.analyze(message, id)` | `POST /api/analyze` | Sending a message |

The first message of a new chat is sent **without** a `session_id`. The backend creates one, and the app moves to `/chat/<session_id>`. Every later message sends that id, so the backend can use the conversation history.

## Project structure

```text
frontend-react/
├── index.html               ← page shell, loads fonts and src/main.jsx
├── vite.config.js           ← dev server + backend proxy
├── public/favicon.svg
└── src/
    ├── main.jsx             ← starts React, loads the CSS
    ├── App.jsx              ← routes: "/" and "/chat/:sessionId?"
    ├── pages/
    │   ├── Documentation.jsx← user guide at /documentation
    │   ├── Landing.jsx      ← home page (smooth section links + scroll highlighting)
    │   └── Chat.jsx         ← chat state, backend calls, export, shortcuts (start here!)
    ├── components/
    │   ├── Sidebar.jsx      ← New chat, search (Ctrl/⌘+K), chats grouped by date, status card
    │   ├── ChatHeader.jsx   ← model chip, insights toggle, copy link, export chat
    │   ├── EmptyState.jsx   ← orb + "How can I assist you today?" + prompt cards
    │   ├── MessageList.jsx  ← user bubbles, assistant answers, thinking indicator
    │   ├── Markdown.jsx     ← renders the AI's Markdown (code blocks, tables)
    │   ├── Composer.jsx     ← message box: "hero" (welcome) and "dock" (in a chat) styles
    │   ├── InsightsPanel.jsx← slide-over panel: intent, risk, priority, follow-ups
    │   ├── SiteHeader.jsx, SiteFooter.jsx ← shared top bar / footer (home + docs)
    ├── hooks/
    │   ├── useBackendStatus.js ← checks /health every 15 s (status + model name)
    │   ├── useTheme.js         ← light/dark mode, remembered in localStorage
    ├── lib/
    │   ├── api.js           ← every fetch() to the backend
    │   ├── intents.js       ← labels + follow-up prompts per intent
    │   └── time.js          ← "10:41 AM", "2m", "Yesterday"
    └── styles/
        ├── global.css       ← colours (light + dark), buttons, Markdown styles
        ├── landing.css
        └── chat.css
```

## Libraries

| Library | Why |
|---|---|
| `react-router-dom` | Page routes (`/`, `/chat/...`) |
| `react-markdown` + `remark-gfm` | Shows the AI's Markdown answer safely (no raw HTML), including tables |
| `lucide-react` | Icons |

## Build for production

```powershell
npm run build      # outputs to dist/
npm run preview    # serve dist/ locally to check it
```

The Vite proxy only works with `npm run dev`. A production build calls the backend at `VITE_API_URL` directly (see `.env.example`).

## Deploying to Vercel

Deploy the backend to Render first. The full guide is in the [root README](../README.md#deploy-backend-on-render-frontend-on-vercel).

| Setting | Value |
|---|---|
| Root Directory | `frontend-react` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variable | `VITE_API_URL` = your Render URL, e.g. `https://ai-assistant-backend.onrender.com` (no trailing slash) |

- **`vercel.json`** sends every path to `index.html`, so refreshing `/chat/<id>` works instead of showing a 404.
- `VITE_API_URL` is **baked in at build time**. After changing it, redeploy.
- On Render, set `ALLOWED_ORIGINS` to your Vercel URL, or the browser will block the requests (CORS).

## Common problems

| What you see | Fix |
|---|---|
| Red dot / "Backend offline" | Start the backend: `uvicorn app.main:app --reload --port 8000` in `backend` |
| "Cannot reach the backend" error | Same as above. On the deployed site: wait a minute (free Render servers sleep), then check `ALLOWED_ORIGINS` on Render matches your Vercel URL exactly |
| "unexpected response… VITE_API_URL" error | `VITE_API_URL` isn't set on Vercel. Add it and redeploy |
| 404 after refreshing a chat on Vercel | Vercel's Root Directory must be `frontend-react`, so `vercel.json` is used |
| `npm` is not recognized | Install Node.js from https://nodejs.org, then reopen the terminal |
| Port 5173 in use | Another Vite server is running. Stop it with `Ctrl + C`, or use the URL Vite prints |
| Where are the intent details? | Click the chart icon in the top bar to open **Message Insights** |
