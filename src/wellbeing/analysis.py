"""Exploratory analysis and model interpretation: everything the dashboard and the conclusions are computed from."""
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.inspection import permutation_importance

from .config import Settings
from .data import CLASSES, TARGET

HOUR_BINS = [0, 2, 4, 6, 8, 100]
HOUR_LABELS = ["< 2 h", "2-4 h", "4-6 h", "6-8 h", "8+ h"]
AGE_BINS = [0, 17, 24, 34, 200]
AGE_LABELS = ["under 18", "18-24", "25-34", "35+"]


def _share(df: pd.DataFrame, by: pd.Series, order: list[str] | None = None) -> list[dict]:
    t = pd.crosstab(by, df[TARGET], normalize="index").reindex(columns=CLASSES, fill_value=0)
    n = by.value_counts()
    means = df.groupby(by, observed=True)["_score"].mean()
    idx = [i for i in (order or list(t.index)) if i in t.index]
    return [{"group": str(i), "n": int(n[i]), "mean_score": round(float(means[i]), 2), **{c.lower(): round(float(t.loc[i, c]) * 100, 1) for c in CLASSES}} for i in idx]


def eda(df: pd.DataFrame, s: Settings) -> dict:
    d = df.copy()
    d["_score"] = d[s.score_column]
    hours = pd.to_numeric(d[s.hours_column], errors="coerce")
    d["_hours"] = pd.cut(hours, HOUR_BINS, labels=HOUR_LABELS, right=False)
    d["_age"] = pd.cut(pd.to_numeric(d[s.age_column], errors="coerce"), AGE_BINS, labels=AGE_LABELS)
    ok = hours.notna()
    rho, p = stats.spearmanr(hours[ok], d.loc[ok, s.score_column])
    exclude = {*s.id_columns, *s.derived_columns, s.score_column}
    num = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and c not in exclude]
    corr = []
    for c in num:
        v = pd.to_numeric(df[c], errors="coerce")
        m = v.notna()
        r, pv = stats.spearmanr(v[m], df.loc[m, s.score_column])
        corr.append({"feature": c, "rho": round(float(r), 3), "p": float(pv), "mediator": c in s.mediator_columns})
    corr.sort(key=lambda x: x["rho"])
    hist, edges = np.histogram(df[s.score_column], bins=20)
    out = {
        "rows": len(df), "columns": df.shape[1],
        "class_counts": {c: int((df[TARGET] == c).sum()) for c in CLASSES},
        "score_hist": {"counts": hist.tolist(), "edges": [round(float(e), 2) for e in edges]},
        "missing": sorted([{"column": c, "pct": round(float(df[c].isna().mean() * 100), 1)} for c in df.columns if df[c].isna().any()], key=lambda x: -x["pct"]),
        "hours_vs_score": {"spearman_rho": round(float(rho), 3), "p_value": float(p), "n": int(ok.sum())},
        "correlations": corr,
        "by_hours": _share(d[ok], d.loc[ok, "_hours"], HOUR_LABELS),
        "by_age": _share(d.dropna(subset=["_age"]), d["_age"].dropna(), AGE_LABELS),
    }
    for key, col in (("by_night", s.night_column), ("by_platform", "primary_platform"), ("by_gender", "gender"), ("by_occupation", "occupation"), ("by_relationship", "relationship_status")):
        if col in d.columns:
            sub = d.dropna(subset=[col])
            out[key] = _share(sub, sub[col].astype(str))
    if s.night_column in d.columns:  # hours x late-night use, the interaction behind "does night use matter at the same hours?"
        sub = d.dropna(subset=[s.night_column, "_hours"])
        out["hours_by_night"] = {
            str(night): [{"group": str(h), "mean_score": round(float(g["_score"].mean()), 2), "n": int(len(g))} for h, g in grp.groupby("_hours", observed=True)]
            for night, grp in sub.groupby(s.night_column)
        }
    return out


def importance(model, X_test: pd.DataFrame, y_test, s: Settings) -> list[dict]:
    """Permutation importance on raw columns: how much macro-F1 drops when one input is shuffled."""
    r = permutation_importance(model, X_test, y_test, scoring="f1_macro", n_repeats=15, random_state=s.random_state, n_jobs=s.n_jobs)
    rows = [{"feature": c, "importance": round(float(m), 4), "std": round(float(sd), 4)} for c, m, sd in zip(X_test.columns, r.importances_mean, r.importances_std)]
    return sorted(rows, key=lambda x: -x["importance"])


def partial_dependence(model, X: pd.DataFrame, column: str, grid: list[float]) -> dict:
    """Average predicted class probabilities as one column is set to each grid value for every row."""
    classes = list(model.classes_)
    out = {c: [] for c in CLASSES}
    for v in grid:
        Xv = X.copy()
        Xv[column] = v
        p = model.predict_proba(Xv).mean(0)
        for c in CLASSES:
            out[c].append(round(float(p[classes.index(c)]) * 100, 2))
    return {"column": column, "grid": grid, "prob_pct": out}


def night_effect(model, X: pd.DataFrame, s: Settings) -> dict:
    """Average predicted probability of Low wellbeing if everyone did / did not use social media late at night."""
    res = {}
    for val in ("Yes", "No"):
        Xv = X.copy()
        Xv[s.night_column] = val
        p = model.predict_proba(Xv).mean(0)
        res[val] = {c: round(float(p[list(model.classes_).index(c)]) * 100, 1) for c in CLASSES}
    return res
