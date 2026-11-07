#!/usr/bin/env bash
# Rename the product everywhere.   Usage (from the repo root):
#   bash rename_project.sh "New Name" new-slug
# Examples:
#   bash rename_project.sh "IntentDesk" intentdesk
#   bash rename_project.sh "LLM Powered AI Assistant" llm-powered-ai-assistant
# Run apply_fixes.sh FIRST (it makes the old slugs consistent: intentdesk-ai-*).
set -euo pipefail

NAME="${1:-}"; SLUG="${2:-}"
[ -n "$NAME" ] && [ -n "$SLUG" ] || { echo 'Usage: bash rename_project.sh "New Name" new-slug'; exit 1; }
[ -d backend ] && [ -d frontend-react ] || { echo "Run this from the repo root."; exit 1; }
[[ "$NAME" =~ ^[A-Za-z0-9][A-Za-z0-9\ \-]*$ ]] || { echo "NAME: letters, digits, spaces and hyphens only (it is placed inside JS/HTML strings)."; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "SLUG: lowercase letters, digits and hyphens only."; exit 1; }

if sed --version >/dev/null 2>&1; then SED=(sed -i); else SED=(sed -i ''); fi

FILES=$(grep -rIl --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude-dir=.git --exclude-dir=.pytest_cache \
        -E "Indigo|intentdesk-ai" . || true)
[ -n "$FILES" ] || { echo "Nothing to rename (already done?)."; exit 0; }

for f in $FILES; do
  # 1. the two split wordmarks ("Indigo" + styled ".ai") become the plain name
  "${SED[@]}" -e "s|Indigo<span className=\"logo-accent\">\.ai</span>|$NAME|" \
              -e "s|Indigo<span className=\"hero-brand-ai\">\.ai</span>|$NAME|" "$f"
  # 2. brand text, then technical slugs (service names, package name, URLs)
  "${SED[@]}" -e "s|Indigo\.ai|$NAME|g" -e "s|intentdesk-ai|$SLUG|g" "$f"
done

echo "Renamed in:"; echo "$FILES" | sed 's/^/  /'
echo
echo "Leftovers (should be '(none)'; a CSS colour called 'indigo' would be fine):"
grep -rIn --exclude-dir=node_modules --exclude-dir=__pycache__ --exclude-dir=.git --exclude-dir=.pytest_cache -i "indigo" . || echo "(none)"
echo
echo "Next: cd backend && pytest   |   cd frontend-react && npm run build   |   git diff"
