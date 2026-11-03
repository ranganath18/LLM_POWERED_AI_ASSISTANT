import pytest

from app.services import database_service as db


@pytest.fixture(autouse=True)
def always_use_sqlite(monkeypatch):
    """Tests must never touch the real (Neon) database, even if DATABASE_URL is set in .env."""
    monkeypatch.setattr(db, "USE_POSTGRES", False)
