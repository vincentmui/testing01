"""End-to-end run: prepare data, tune models, tune the threshold, interpret, and save the model + report."""
import json
import time
from collections.abc import Callable
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin

from . import analysis, findings, modeling
from .config import Settings
from .data import CLASSES, TARGET, feature_frame, prepare


class TunedModel(ClassifierMixin, BaseEstimator):
    """The final classifier: a fitted pipeline plus per-class probability weights (the tuned decision threshold)."""

    def __init__(self, pipe, weights: np.ndarray):
        self.pipe, self.weights = pipe, np.asarray(weights)
        self.classes_ = np.array(CLASSES)  # the order of predict_proba's columns

    def fit(self, X=None, y=None):  # already fitted; present so scikit-learn utilities accept the object
        return self

    def _ordered(self, X) -> np.ndarray:
        proba = self.pipe.predict_proba(X)
        return proba[:, [list(self.pipe.classes_).index(c) for c in CLASSES]]

    def predict_proba(self, X) -> np.ndarray:
        """Probabilities in CLASSES order (Low, Medium, High), after weighting and re-normalising."""
        w = self._ordered(X) * self.weights
        return w / w.sum(1, keepdims=True)

    def predict(self, X) -> np.ndarray:
        return np.array(CLASSES)[self.predict_proba(X).argmax(1)]


def run(s: Settings, progress: Callable[[str, int, int], None] = lambda *_: None) -> dict:
    t0 = time.time()
    df, info = prepare(s)
    X = feature_frame(df, s)
    X_train, X_test, y_train, y_test = modeling.split(df, X, s)
    tuned = modeling.tune_all(X_train, y_train, X_test, y_test, s, progress)
    best_key = tuned["best_key"]
    best_row = next(r for r in tuned["results"] if r["key"] == best_key)

    progress("Tuning the decision threshold", 6, 8)
    thr, weights, pipe = modeling.tune_thresholds(X_train, y_train, X_test, y_test, best_key, best_row["best_params"], s)
    final = TunedModel(pipe, weights)
    final_pred = final.predict(X_test)

    progress("Interpreting the best model", 7, 8)
    imp = analysis.importance(final, X_test, y_test, s)
    hours = pd.to_numeric(X[s.hours_column], errors="coerce")
    grid = [round(float(v), 1) for v in np.arange(0.5, 10.01, 0.5)]
    pdp = analysis.partial_dependence(final, X_test, s.hours_column, grid)
    night = analysis.night_effect(final, X_test, s) if s.night_column in X.columns else None
    notif = analysis.partial_dependence(final, X_test, "notifications_per_day", [5, 20, 40, 60, 80, 100, 120, 140]) if "notifications_per_day" in X.columns else None

    # Benchmark: does adding the mental-state measures (anxiety, depression, ...) change what is predictable?
    Xm = feature_frame(df, s, mediators=True)
    Xm_train, Xm_test = Xm.loc[X_train.index], Xm.loc[X_test.index]
    est = modeling.candidates(s)[best_key][0]
    mpipe = modeling.make_pipeline(Xm_train, est, s).set_params(**{f"model__{k}": v for k, v in best_row["best_params"].items()})
    mpipe.fit(Xm_train, y_train)
    bench = modeling.metrics(y_test, mpipe.predict(Xm_test))

    eda = {**analysis.eda(df, s), "cuts": info["cuts"]}
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seconds": round(time.time() - t0, 1),
        "data": {**info, "train_rows": len(X_train), "test_rows": len(X_test), "features_in": X.shape[1], "features_kept": s.n_features,
                 "inputs": list(X.columns), "excluded": {"ids": s.id_columns, "derived": s.derived_columns, "mediators": s.mediator_columns},
                 "settings": {"low_quantile": s.low_quantile, "test_size": s.test_size, "cv_folds": s.cv_folds, "random_state": s.random_state, "quick": s.quick}},
        "eda": eda,
        "models": tuned["results"],
        "best": {"key": best_key, "name": best_row["name"], "params": best_row["best_params"], "cv_f1_macro": best_row["cv_f1_macro"]},
        "threshold": thr,
        "final": {"test": modeling.metrics(y_test, final_pred, final.predict_proba(X_test), CLASSES), "per_class": modeling.class_report(y_test, final_pred)},
        "importance": imp,
        "partial_dependence": {"hours": pdp, "notifications": notif},
        "night_effect": night,
        "mediator_benchmark": {"test": bench, "without": modeling.metrics(y_test, final_pred)},
        "options": options(df, X, s),
    }
    report["findings"] = findings.build(report)
    report["business_summary"] = findings.business_summary(report)
    s.artifacts_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": final, "inputs": list(X.columns), "classes": CLASSES}, s.artifacts_dir / "model.joblib")
    (s.artifacts_dir / "report.json").write_text(json.dumps(report, indent=2, default=float))
    progress("Done", 8, 8)
    return report


def options(df: pd.DataFrame, X: pd.DataFrame, s: Settings) -> dict:
    """What the prediction form needs: allowed values for text columns, ranges for numbers, and a typical (mode / median) starting value for each."""
    cats, nums, typical = {}, {}, {}
    for c in X.columns:
        if c in s.categorical_columns:
            cats[c] = sorted(df[c].dropna().astype(str).unique().tolist())
            typical[c] = str(df[c].mode().iloc[0])
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            nums[c] = {"min": float(v.min()), "max": float(v.max()), "median": float(v.median())}
            typical[c] = round(float(v.median()), 1)
    return {"categorical": cats, "numeric": nums, "typical": typical}
