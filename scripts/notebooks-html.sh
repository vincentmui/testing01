#!/usr/bin/env bash
# Export the notebooks to HTML so the UI's Notebooks page can open them (frontend/public/notebooks/).
# Re-run after editing or re-executing a notebook. Usage: scripts/notebooks-html.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p frontend/public/notebooks
uv run jupyter nbconvert --to html --output-dir frontend/public/notebooks notebooks/*.ipynb
