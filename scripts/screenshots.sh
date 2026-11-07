#!/usr/bin/env bash
# Regenerate the screenshots used by the in-app User guide (frontend/public/docs/*.png).
# Needs the app running (./start.sh) and Google Chrome. Usage: scripts/screenshots.sh [ui_url]
set -euo pipefail
cd "$(dirname "$0")/.."
UI="${1:-http://localhost:${UI_PORT:-5180}}"
CHROME="${CHROME:-google-chrome}"
OUT=frontend/public/docs
mkdir -p "$OUT"

shot() {  # name, path, height
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=12000 --window-size=1360,"$3" --screenshot="$OUT/$1.png" "$UI$2" >/dev/null 2>&1
  echo "  $1.png"
}

shot overview   /                                       1500
shot explore    /explore                                1900
shot models     /models                                 1900
shot insights   /insights                               1900
shot method     /method                                 1500
shot notebooks  /notebooks                              1000
shot predict    /predict                                1900
shot predict-heavy "/predict?preset=Heavy%20late-night%20use" 1900
shot summary    /summary                                1500
shot api        /api-docs                               1400
