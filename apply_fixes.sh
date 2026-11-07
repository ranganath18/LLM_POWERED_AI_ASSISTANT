#!/usr/bin/env bash
# IntentDesk AI housekeeping: stale "Week N" labels, Neon->Supabase, naming, leftover file.
# Run from the REPOSITORY ROOT (the folder that contains backend/ and frontend-react/).
# Works on Git Bash (Windows), macOS and Linux. Review the result with `git diff` before committing.
set -euo pipefail

[ -d backend ] && [ -d frontend-react ] || { echo "Run this from the repo root."; exit 1; }

# GNU sed (Linux/Git Bash) vs BSD sed (macOS) differ in the -i flag.
if sed --version >/dev/null 2>&1; then SED=(sed -i); else SED=(sed -i ''); fi

# 1. Leftover helper file that says "do not commit me"
rm -f README_REPO_FIX.txt

# 2. backend/README.md: drop "Week N" labels, Neon -> Supabase, remove two stale notes
"${SED[@]}" \
 -e 's/ (Week [0-9])//' \
 -e 's/: Week 1 data rules/: request and intent-result rules/' \
 -e 's/: Week 1, classify the message/: classify the message/' \
 -e 's/: Week 2 data rules/: reply and token-usage schemas/' \
 -e 's/: Week 3, chat history/: chat history/' \
 -e 's/: Week 2, write the answer/: write the answer/' \
 -e 's/validated\*\* Week 1 result/validated** intent result/' \
 -e 's/(Week 3: save user + assistant messages)/(save user + assistant messages)/' \
 -e 's/(Week 2, with history)/(with history)/' \
 -e 's/ *(Week [0-9])//' \
 -e 's/| Week 1 Pydantic rules/| Pydantic rules/' \
 -e 's/| Week 3 SQLite storage/| SQLite storage/' \
 -e 's/call the Week 1 service directly/call the classification service directly/' \
 -e 's/sent to the LLM in Week 1/sent to the LLM/' \
 -e 's/Neon/Supabase/g' \
 -e '/conversation_service.py` is the old in-memory/d' \
 -e '/The conversation row is created before the LLM is called/d' \
 backend/README.md

# 3. Comments and docstrings in code
"${SED[@]}" 's/(Neon)/(Supabase)/' backend/requirements.txt
"${SED[@]}" 's/"""Week 2 response: intent analysis plus generated answer."""/"""Intent analysis plus the generated answer."""/' backend/app/schemas/assistant.py
"${SED[@]}" 's/(e.g. the Week 4 deploy)/(e.g. the first production deploy)/' backend/app/services/database_service.py
"${SED[@]}" 's/ (Week 4)//' backend/tests/test_api.py

# 4. One name everywhere: IntentDesk AI (product), intentdesk-ai-* (technical slugs)
"${SED[@]}" -e 's/prompt-gate-ai-backend/intentdesk-ai-backend/' \
            -e 's#https://prompt-gate-ai.vercel.app#https://intentdesk-ai.vercel.app#' render.yaml
"${SED[@]}" 's/ai-assistant-frontend/intentdesk-ai-frontend/g' frontend-react/package.json frontend-react/package-lock.json

echo
echo "Remaining stale references (should print only '(none)'):"
grep -rIn --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude-dir=.git --exclude=package-lock.json \
  -E "Week [0-9]|Neon|prompt_gate|prompt-gate|Inflow|Enterprise Ingestion|[^.]env\.example|README_BACKEND|README_FRONTEND|conversation_service|ai-assistant-frontend|REPO_FIX" . \
  || echo "(none)"
echo
echo "Next: copy the new README.md and backend/sql/schema.sql into the repo, run pytest, then review with 'git diff'."
