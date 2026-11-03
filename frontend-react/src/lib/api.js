// All calls to the FastAPI backend live here.
// In development the Vite proxy forwards /api and /health to http://127.0.0.1:8000.
// In production (Vercel) set VITE_API_URL to the Render backend URL; see .env.example.
const BASE_URL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

// Messages shown to users stay simple; technical hints go to the browser console for developers.
const UNREACHABLE = "Can't reach the server right now. Please try again in a moment.";
const UNEXPECTED = "Something went wrong. Please try again.";

function logForDevelopers(hint) {
  console.warn(`[Indigo.ai] ${hint}`);
}

function errorMessage(data, status) {
  const detail = data?.detail;
  logForDevelopers(`Request failed with status ${status}: ${JSON.stringify(detail ?? null)}`);
  if (status === 422) return "Please check your message and try again.";
  if (typeof detail === "string") return detail; // the backend's messages are written for users
  return UNEXPECTED;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    logForDevelopers(`Network error calling ${path}. Is the backend running, and does it allow this site (CORS)?`);
    throw new Error(UNREACHABLE);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Some error pages are not JSON; fall through with data = null.
  }

  if (!response.ok) throw new Error(errorMessage(data, response.status));
  if (response.status === 204) return null; // success with no body (e.g. DELETE)
  if (data === null) {
    logForDevelopers(`${path} did not return JSON. Check that VITE_API_URL points to the backend.`);
    throw new Error(UNEXPECTED);
  }
  return data;
}

export const api = {
  /** GET /health → { status, message, database } */
  health: () => request("/health"),

  /** GET /api/conversations → [{ session_id, title, updated_at, preview }] */
  listConversations: () => request("/api/conversations").then((data) => data.items),

  /** GET /api/conversations/:id/messages → { items: [{ role, content, created_at }], archive: null | { archived_at, delete_at } } */
  getConversation: (sessionId) => request(`/api/conversations/${sessionId}/messages`),

  /** GET /api/conversations/archived → { retention_days, items: [{ session_id, title, archived_at, delete_at }] } */
  listArchived: () => request("/api/conversations/archived"),

  /** POST /api/conversations/:id/archive → moves the chat to the archive */
  archiveConversation: (sessionId) => request(`/api/conversations/${sessionId}/archive`, { method: "POST" }),

  /** POST /api/conversations/:id/restore → brings an archived chat back */
  restoreConversation: (sessionId) => request(`/api/conversations/${sessionId}/restore`, { method: "POST" }),

  /** PATCH /api/conversations/:id → { session_id, title } */
  renameConversation: (sessionId, title) =>
    request(`/api/conversations/${sessionId}`, { method: "PATCH", body: JSON.stringify({ title }) }),

  /** DELETE /api/conversations/:id → removes the chat and its messages permanently */
  deleteConversation: (sessionId) => request(`/api/conversations/${sessionId}`, { method: "DELETE" }),

  /**
   * POST /api/analyze → intent analysis + response_markdown + session_id.
   * Leave sessionId empty to start a new conversation.
   */
  analyze: (message, sessionId) =>
    request("/api/analyze", {
      method: "POST",
      body: JSON.stringify(sessionId ? { message, session_id: sessionId } : { message }),
    }),

  analyzeStream,
};

/**
 * POST /api/analyze/stream: the answer arrives piece by piece.
 * The server sends one JSON object per line: "analysis", then many "token", then "done" (or "error").
 *
 * options:
 *   sessionId   continue a saved chat (normal mode)
 *   incognito   true = nothing is saved on the server
 *   history     incognito only: recent [{ role, content }] messages
 *   onAnalysis  called once with the intent analysis
 *   onToken     called with each new piece of text
 *   signal      AbortController signal, used by the Stop button
 * Resolves with { session_id, token_usage } when the answer is complete.
 */
async function analyzeStream(message, options = {}) {
  const { sessionId, incognito, history, onAnalysis, onToken, signal } = options;
  const body = incognito
    ? { message, incognito: true, history: history ?? [] }
    : sessionId
      ? { message, session_id: sessionId }
      : { message };

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/analyze/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    logForDevelopers("Network error calling /api/analyze/stream. Is the backend running, and does it allow this site (CORS)?");
    throw new Error(UNREACHABLE);
  }

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      // Not JSON; use the status code below.
    }
    throw new Error(errorMessage(data, response.status));
  }

  let finished = null;
  const handleLine = (line) => {
    if (!line.trim()) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      logForDevelopers("The stream sent a line that isn't JSON. Check that VITE_API_URL points to the backend.");
      throw new Error(UNEXPECTED);
    }
    if (event.type === "analysis") onAnalysis?.(event);
    else if (event.type === "token") onToken?.(event.text);
    else if (event.type === "done") finished = event;
    else if (event.type === "error") throw new Error(event.detail);
  };

  // Read the response as it arrives, splitting it into lines.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    lines.forEach(handleLine);
  }
  handleLine(buffer + decoder.decode());

  if (!finished) throw new Error("The reply was cut off. Please try again.");
  return finished;
}
