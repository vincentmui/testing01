#!/usr/bin/env bash
# Stop the API and UI started by start.sh (only processes of this project; other servers are left alone).
cd "$(dirname "$0")"
ROOT="$(pwd -P)"
API_PORT="${API_PORT:-8010}"
UI_PORT="${UI_PORT:-5180}"

in_project() { case "$(readlink "/proc/$1/cwd" 2>/dev/null)" in "$ROOT"|"$ROOT"/*) return 0;; esac; return 1; }

# Start from whatever listens on our ports, then walk up to the parents (start.sh, npm, the uvicorn reloader).
mine=""
for p in $(ss -ltnpH "sport = :$API_PORT or sport = :$UI_PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); do
  while [ "${p:-0}" -gt 1 ] && in_project "$p"; do
    mine="$mine $p"
    p=$(ps -o ppid= -p "$p" | tr -d ' ')
  done
done
mine=$(echo $mine | tr ' ' '\n' | sort -un | tr '\n' ' ')

if [ -z "${mine// /}" ]; then echo "Nothing running on ports $API_PORT and $UI_PORT."; exit 0; fi
for p in $mine; do pkill -P "$p" 2>/dev/null || true; done   # their children (reload workers, esbuild)
kill $mine 2>/dev/null || true
sleep 1
for p in $mine; do kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null || true; done
echo "Stopped: $mine"
