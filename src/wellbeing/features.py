"""Feature engineering as scikit-learn steps, so it runs inside every cross-validation fold (no leakage)."""
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .config import Settings

AGE_BINS = [0, 17, 24, 34, 200]
AGE_LABELS = ["under 18", "18-24", "25-34", "35+"]


class Engineer(BaseEstimator, TransformerMixin):
    """Adds night_hours (hours x late-night use), notifications_per_hour and age_group."""

    def __init__(self, hours="daily_usage_hours", age="age", night="late_night_usage"):
        self.hours, self.age, self.night = hours, age, night

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()
        hours = pd.to_numeric(X[self.hours], errors="coerce")
        if self.night in X:
            X["night_hours"] = X[self.night].astype("string").str.lower().eq("yes").astype(float) * hours
        if "notifications_per_day" in X:
            X["notifications_per_hour"] = pd.to_numeric(X["notifications_per_day"], errors="coerce") / hours.clip(lower=0.5)
        if self.age in X:
            X["age_group"] = pd.cut(pd.to_numeric(X[self.age], errors="coerce"), AGE_BINS, labels=AGE_LABELS).astype(object)
        return X


def build_preprocessor(X: pd.DataFrame, s: Settings) -> Pipeline:
    """Engineer -> impute -> scale / one-hot -> keep the n most informative columns (ANOVA F-test)."""
    cats = [c for c in s.categorical_columns if c in X.columns] + (["age_group"] if s.age_column in X.columns else [])
    nums = [c for c in X.columns if c not in s.categorical_columns]
    nums += (["night_hours"] if s.night_column in X.columns else []) + (["notifications_per_hour"] if "notifications_per_day" in X.columns else [])
    columns = ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median", add_indicator=False)), ("scale", StandardScaler())]), nums),
        ("cat", Pipeline([("impute", SimpleImputer(strategy="constant", fill_value="Unknown")), ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), cats),
    ])
    engineer = Engineer(s.hours_column, s.age_column, s.night_column)
    k = s.n_features
    return Pipeline([("engineer", engineer), ("columns", columns), ("select", SelectKBest(f_classif, k=k))])
