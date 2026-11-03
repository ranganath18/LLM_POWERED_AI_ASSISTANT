import pytest

from app.services import database_service as db


@pytest.fixture(autouse=True)
def isolated_sqlite(monkeypatch, tmp_path):
    """Tests must never touch the real (Supabase) database, even if DATABASE_URL is set in .env."""
    monkeypatch.setattr(db, "USE_POSTGRES", False)
    monkeypatch.setattr(db, "db_path", tmp_path / "test_chat.db")
    monkeypatch.setattr(db, "_ready_key", None)
