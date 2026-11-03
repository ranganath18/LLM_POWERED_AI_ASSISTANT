REPO FIX KIT - brings your repo (mentor's frontend + your old backend) in line with the mentor's repo.

1. Copy every file here into the same path in your repo, replacing the old ones.
2. Delete backend/app/services/conversation_service.py (old in-memory store, no longer used).
3. Do not commit this README.

Contents: backend code for streaming / archive / rename / incognito / token usage,
Postgres (Supabase) layer, updated tests, render.yaml (Render Blueprint), root .gitignore.
The frontend is NOT touched: you already have the mentor's frontend.
