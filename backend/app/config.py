import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env when running from the backend folder or repository root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
DATABASE_URL=os.getenv("DATABASE_URL").strip()
