import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env when running from the backend folder or repository root.
# On Render there is no .env file: values come from the dashboard's Environment tab.
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "").strip() or "openai/gpt-oss-120b"

# PostgreSQL connection string (Supabase). When set, chats are stored there;
# when empty, a local SQLite file is used instead (local development and tests).
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Relative paths are resolved from the backend folder, not the current directory.
SQLITE_PATH = str(BACKEND_DIR / (os.getenv("SQLITE_PATH", "").strip() or "data/chat.db"))

# Archived (and deleted) chats are permanently removed after this many days.
try:
    ARCHIVE_RETENTION_DAYS = int(os.getenv("ARCHIVE_RETENTION_DAYS", "").strip() or 30)
except ValueError:
    ARCHIVE_RETENTION_DAYS = 30

# Websites allowed to call this API from a browser (CORS), comma-separated.
# In production set it to your Vercel URL, e.g. https://your-app.vercel.app
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
