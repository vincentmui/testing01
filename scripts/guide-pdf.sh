#!/usr/bin/env bash
# Build the downloadable PDF of the in-app User guide (frontend/public/docs/user-guide.pdf).
# Needs the app running (./start.sh) and Google Chrome. Run scripts/screenshots.sh first if the UI changed.
set -euo pipefail
cd "$(dirname "$0")/.."
UI="${1:-http://localhost:${UI_PORT:-5180}}"
"${CHROME:-google-chrome}" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=12000 \
  --print-to-pdf=frontend/public/docs/user-guide.pdf "$UI/guide" >/dev/null 2>&1
echo "frontend/public/docs/user-guide.pdf"
