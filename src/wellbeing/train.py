"""Command line: uv run python -m wellbeing.train [--quick]"""
import argparse

from .config import get_settings
from .pipeline import run

p = argparse.ArgumentParser(description="Run the full CRISP-DM analysis and save the model and report.")
p.add_argument("--quick", action="store_true", help="small grids, for a fast check")
a = p.parse_args()
s = get_settings()
if a.quick:
    s.quick = True
r = run(s, lambda msg, i, n: print(f"[{i}/{n}] {msg}", flush=True))
print(f"\nBest model: {r['best']['name']} {r['best']['params']}  (CV macro-F1 {r['best']['cv_f1_macro']})")
print(f"Test: {r['final']['test']}")
print(f"Saved to {s.artifacts_dir}/ in {r['seconds']} s")
