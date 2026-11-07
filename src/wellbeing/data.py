"""Data understanding and preparation: load the CSV, clean it, create the High / Medium / Low target."""
import re

import numpy as np
import pandas as pd

from .config import Settings

CLASSES = ["Low", "Medium", "High"]  # ordered, worst to best
TARGET = "wellbeing_class"


def clean_name(name: str) -> str:
    return re.sub(r"[^0-9a-z]+", "_", name.strip().lower()).strip("_")


def load_raw(s: Settings) -> pd.DataFrame:
    if not s.data_file.exists():
        raise FileNotFoundError(f"Dataset not found at {s.data_file}. Put the CSV there or set DATA_FILE in .env.")
    df = pd.read_csv(s.data_file)
    df.columns = [clean_name(c) for c in df.columns]
    return df


def clean(df: pd.DataFrame, s: Settings) -> tuple[pd.DataFrame, dict]:
    """Drop duplicates and rows without a score, tidy text; return the frame and what was done."""
    log = {"rows_in": len(df)}
    for c in (s.score_column, s.hours_column):
        if c not in df.columns:
            raise ValueError(f"Column '{c}' not found. The file has: {list(df.columns)}. Set the name in .env (see config.py).")
    df = df.drop_duplicates(subset=[c for c in df.columns if c not in s.id_columns])
    log["duplicates_removed"] = log["rows_in"] - len(df)
    for c in s.categorical_columns:
        if c in df.columns:
            df[c] = df[c].astype("string").str.strip().astype(object).where(df[c].notna(), np.nan)  # plain NaN, which scikit-learn imputers accept
    df[s.score_column] = pd.to_numeric(df[s.score_column], errors="coerce")
    before = len(df)
    df = df.dropna(subset=[s.score_column])  # no score = no label
    log["rows_without_score"] = before - len(df)
    log["rows_out"] = len(df)
    log["missing_cells"] = int(df.drop(columns=s.id_columns, errors="ignore").isna().sum().sum())  # filled later, inside each CV fold
    return df.reset_index(drop=True), log


def add_target(df: pd.DataFrame, s: Settings) -> tuple[pd.DataFrame, dict]:
    """Split the score at its tertiles: bottom third = Low, middle = Medium (the median sits inside it), top third = High."""
    lo, hi = df[s.score_column].quantile([s.low_quantile, 1 - s.low_quantile])
    out = df.copy()
    out[TARGET] = pd.cut(out[s.score_column], [-np.inf, lo, hi, np.inf], labels=CLASSES, right=False).astype(str)
    return out, {"low_below": float(lo), "high_from": float(hi), "median": float(df[s.score_column].median())}


def prepare(s: Settings) -> tuple[pd.DataFrame, dict]:
    df, log = clean(load_raw(s), s)
    df, cuts = add_target(df, s)
    return df, {"cleaning": log, "cuts": cuts, "file": s.data_file.name}


def feature_frame(df: pd.DataFrame, s: Settings, mediators: bool = False) -> pd.DataFrame:
    """The model inputs: everything except ids, derived labels, the score itself, the target and (by default) mediators."""
    drop = [*s.id_columns, *s.derived_columns, s.score_column, TARGET] + ([] if mediators else s.mediator_columns)
    return df.drop(columns=[c for c in drop if c in df.columns])
