"""Modelling: six classifiers tuned by grid search, the best chosen on cross-validated macro-F1, then threshold tuning."""
import time
from collections.abc import Callable

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_predict, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

from .config import Settings
from .data import CLASSES, TARGET
from .features import build_preprocessor

LABELS = {
    "logreg": "Logistic regression", "tree": "Decision tree", "knn": "K-nearest neighbours",
    "forest": "Random forest", "svm_linear": "SVM (linear kernel)", "svm_rbf": "SVM (Gaussian / RBF kernel)",
}


def candidates(s: Settings) -> dict[str, tuple[object, dict, dict]]:
    """name -> (estimator, full grid, quick grid). Grid keys address the 'model' step of the pipeline."""
    rs = s.random_state
    return {
        "logreg": (LogisticRegression(max_iter=2000, random_state=rs), {"C": [0.01, 0.1, 1, 10]}, {"C": [0.1, 1]}),
        "tree": (DecisionTreeClassifier(random_state=rs),
                 {"max_depth": [3, 5, 8, None], "min_samples_leaf": [5, 20], "criterion": ["gini", "entropy"]}, {"max_depth": [3, 5], "min_samples_leaf": [20]}),
        "knn": (KNeighborsClassifier(), {"n_neighbors": [5, 11, 21, 31], "weights": ["uniform", "distance"]}, {"n_neighbors": [11, 21]}),
        "forest": (RandomForestClassifier(random_state=rs, n_jobs=s.n_jobs),
                   {"n_estimators": [200, 400], "max_depth": [6, 12, None], "min_samples_leaf": [2, 5]}, {"n_estimators": [50], "max_depth": [6], "min_samples_leaf": [5]}),
        "svm_linear": (SVC(kernel="linear", random_state=rs), {"C": [0.1, 1, 10]}, {"C": [1]}),
        "svm_rbf": (SVC(kernel="rbf", random_state=rs), {"C": [0.5, 1, 5, 10], "gamma": ["scale", 0.01, 0.03]}, {"C": [1], "gamma": ["scale"]}),
    }


def split(df: pd.DataFrame, X: pd.DataFrame, s: Settings):
    return train_test_split(X, df[TARGET], test_size=s.test_size, stratify=df[TARGET], random_state=s.random_state)


def metrics(y_true, y_pred, proba=None, classes=None) -> dict:
    out = {
        "accuracy": accuracy_score(y_true, y_pred), "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "precision_macro": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "recall_macro": recall_score(y_true, y_pred, average="macro", zero_division=0),
        "f1_macro": f1_score(y_true, y_pred, average="macro"),
    }
    if proba is not None:
        order = np.argsort(classes)  # roc_auc_score wants the label columns in sorted order
        out["roc_auc_ovr"] = roc_auc_score(y_true, np.asarray(proba)[:, order], multi_class="ovr", average="macro", labels=np.asarray(classes)[order])
    return {k: round(float(v), 4) for k, v in out.items()}


def class_report(y_true, y_pred) -> list[dict]:
    p = precision_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0)
    r = recall_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0)
    f = f1_score(y_true, y_pred, labels=CLASSES, average=None)
    return [{"class": c, "precision": round(float(p[i]), 3), "recall": round(float(r[i]), 3), "f1": round(float(f[i]), 3), "support": int((np.asarray(y_true) == c).sum())} for i, c in enumerate(CLASSES)]


def make_pipeline(X: pd.DataFrame, estimator, s: Settings) -> Pipeline:
    return Pipeline([("prep", build_preprocessor(X, s)), ("model", estimator)])


def tune_all(X_train, y_train, X_test, y_test, s: Settings, progress: Callable[[str, int, int], None] = lambda *_: None) -> dict:
    """Grid-search every candidate on the training set; score all of them on the untouched test set."""
    cv = StratifiedKFold(s.cv_folds, shuffle=True, random_state=s.random_state)
    results, fitted = [], {}
    base = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)
    results.append({"key": "baseline", "name": "Baseline (always the majority class)", "cv_f1_macro": None, "best_params": {}, "fit_seconds": 0.0,
                    "test": metrics(y_test, base.predict(X_test))})
    cands = candidates(s)
    for i, (key, (est, full, quick)) in enumerate(cands.items()):
        progress(f"Tuning {LABELS[key]}", i, len(cands))
        grid = {f"model__{k}": v for k, v in (quick if s.quick else full).items()}
        gs = GridSearchCV(make_pipeline(X_train, est, s), grid, cv=cv, scoring="f1_macro", n_jobs=s.n_jobs, refit=True)
        t0 = time.time()
        gs.fit(X_train, y_train)
        fit_s = time.time() - t0
        best = gs.best_estimator_
        pred = best.predict(X_test)
        proba = best.predict_proba(X_test) if hasattr(best, "predict_proba") else None
        row = {"key": key, "name": LABELS[key], "cv_f1_macro": round(float(gs.best_score_), 4),
               "cv_f1_std": round(float(gs.cv_results_["std_test_score"][gs.best_index_]), 4),
               "best_params": {k.removeprefix("model__"): v for k, v in gs.best_params_.items()},
               "grid_size": len(gs.cv_results_["params"]), "fit_seconds": round(fit_s, 1), "test": metrics(y_test, pred, proba, list(best.classes_))}
        results.append(row)
        fitted[key] = gs
    # The winner is chosen on cross-validated macro-F1 (training data only), never on the test set.
    best_key = max((r for r in results if r["key"] != "baseline"), key=lambda r: r["cv_f1_macro"])["key"]
    return {"results": results, "best_key": best_key, "fitted": fitted}


def tune_thresholds(X_train, y_train, X_test, y_test, best_key: str, best_params: dict, s: Settings) -> tuple[dict, np.ndarray, Pipeline]:
    """Decision-threshold tuning for three classes: scale each class's probability, then take the argmax.

    The scale factors are searched on out-of-fold probabilities from the training set, so the test set stays untouched.
    """
    est = clone(candidates(s)[best_key][0]).set_params(**best_params)
    if isinstance(est, SVC):  # SVC has no native probabilities; calibrate its scores instead
        est = CalibratedClassifierCV(est, method="sigmoid", ensemble=False)
    pipe = make_pipeline(X_train, est, s)
    cv = StratifiedKFold(s.cv_folds, shuffle=True, random_state=s.random_state)
    oof = cross_val_predict(pipe, X_train, y_train, cv=cv, method="predict_proba", n_jobs=s.n_jobs)
    classes = np.array(sorted(set(y_train)))
    pipe.fit(X_train, y_train)
    proba_test = pipe.predict_proba(X_test)
    order = [list(classes).index(c) for c in CLASSES]  # to Low, Medium, High columns
    oof, proba_test = oof[:, order], proba_test[:, order]
    labels = np.array(CLASSES)

    def f1_of(w, p, y):
        return f1_score(y, labels[(p * w).argmax(1)], average="macro")

    grid = np.round(np.arange(0.6, 1.81, 0.1), 2)
    best_w, best_f = (1.0, 1.0, 1.0), f1_of((1, 1, 1), oof, y_train)
    default_oof = best_f
    for wl in grid:
        for wh in grid:
            f = f1_of((wl, 1.0, wh), oof, y_train)
            if f > best_f + 1e-9:
                best_w, best_f = (float(wl), 1.0, float(wh)), f
    pred_default = labels[proba_test.argmax(1)]
    pred_tuned = labels[(proba_test * np.array(best_w)).argmax(1)]
    out = {
        "weights": dict(zip(CLASSES, best_w)), "oof_f1_default": round(default_oof, 4), "oof_f1_tuned": round(best_f, 4),
        "test_default": metrics(y_test, pred_default), "test_tuned": metrics(y_test, pred_tuned),
        "adopted": bool(best_f > default_oof + 0.01),  # only a clear (1 point of F1) out-of-fold gain counts
        "confusion_default": confusion_matrix(y_test, pred_default, labels=CLASSES).tolist(),
        "confusion_tuned": confusion_matrix(y_test, pred_tuned, labels=CLASSES).tolist(),
        "per_class_default": class_report(y_test, pred_default), "per_class_tuned": class_report(y_test, pred_tuned),
    }
    return out, np.array(best_w if out["adopted"] else (1.0, 1.0, 1.0)), pipe
