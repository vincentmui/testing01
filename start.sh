#!/usr/bin/env bash
# Start the API (default :8010) and the UI (default :5180). Trains the model first if there is no report yet. Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")"
API_PORT="${API_PORT:-8010}"
UI_PORT="${UI_PORT:-5180}"

[ -f data/social_media_addiction_mental_wellbeing.csv ] || { echo "Dataset missing: put the CSV in data/ (or set DATA_FILE in .env)" >&2; [ -n "${DATA_FILE:-}" ] || exit 1; }
[ -f artifacts/report.json ] || { echo "No trained model yet: training (about a minute)"; uv run python -m wellbeing.train; }
[ -d frontend/node_modules ] || (cd frontend && npm install)

trap 'kill 0' EXIT   # stop both child processes when this script exits
uv run uvicorn wellbeing.main:app --port "$API_PORT" --reload &
(cd frontend && API_URL="http://localhost:$API_PORT" UI_PORT="$UI_PORT" npm run dev) &

echo "UI: http://localhost:$UI_PORT   API docs: http://localhost:$API_PORT/api/docs"
wait
