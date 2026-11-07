"""FastAPI app. Create it with create_app(settings) so tests can point it at their own data and artifacts."""
import io
import json
import threading
import uuid

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from . import pipeline
from .config import Settings, get_settings
from .data import CLASSES, clean_name

DESCRIPTION = """Is social media usage related to mental wellbeing? This API serves the results of a CRISP-DM classification study
(wellbeing score split into Low / Medium / High) and predicts a wellbeing group from a person's social media habits.

Results endpoints read artifacts/report.json; run POST /api/train once (or uv run python -m wellbeing.train) to create it."""

TAGS = [
    {"name": "Predict", "description": "Classify a person, with what-if scenarios."},
    {"name": "Results", "description": "Data profile, model comparison, interpretation and conclusions."},
    {"name": "Training", "description": "Re-run the whole analysis as a background job."},
    {"name": "System", "description": "Health and branding."},
]


class PredictRequest(BaseModel):
    inputs: dict[str, str | float | int | None] = Field(
        description="Column name -> value. Leave out anything unknown; it is filled with the training median or 'Unknown'. See GET /api/predict/options for the columns and allowed values.",
        examples=[{"age": 24, "gender": "Female", "daily_usage_hours": 6.5, "late_night_usage": "Yes", "first_check_morning": "Within 5 min", "failed_to_cut_back": "Yes", "fomo_score": 7}],
    )


class TrainJob(BaseModel):
    id: str
    status: str = Field(description="running, done or failed")
    message: str = ""
    done: int = 0
    total: int = 8
    error: str | None = None


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or get_settings()
    app = FastAPI(title=s.app_name, description=DESCRIPTION, version="1.0.0", openapi_tags=TAGS,
                  docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")  # under /api so the UI's dev proxy reaches it
    jobs: dict[str, dict] = {}
    cache: dict = {}
    lock = threading.Lock()

    def report() -> dict:
        path = s.artifacts_dir / "report.json"
        if not path.exists():
            raise HTTPException(404, "No trained model yet. Call POST /api/train (or run `uv run python -m wellbeing.train`).")
        mtime = path.stat().st_mtime
        if cache.get("mtime") != mtime:
            cache.update(mtime=mtime, report=json.loads(path.read_text()), bundle=joblib.load(s.artifacts_dir / "model.joblib"))
        return cache["report"]

    def bundle() -> dict:
        report()
        return cache["bundle"]

    def frame(rows: list[dict]) -> pd.DataFrame:
        b = bundle()
        return pd.DataFrame(rows).reindex(columns=b["inputs"]).replace({None: np.nan})

    def validate(inputs: dict) -> dict:
        opts = report()["options"]
        clean_in = {}
        for k, v in inputs.items():
            if k not in opts["categorical"] and k not in opts["numeric"]:
                raise HTTPException(422, f"Unknown input '{k}'. Allowed: {sorted([*opts['categorical'], *opts['numeric']])}")
            if v is None or v == "":
                continue
            if k in opts["categorical"]:
                if str(v) not in opts["categorical"][k]:
                    raise HTTPException(422, f"'{v}' is not a known value for '{k}'. Allowed: {opts['categorical'][k]}")
                clean_in[k] = str(v)
            else:
                try:
                    clean_in[k] = float(v)
                except (TypeError, ValueError):
                    raise HTTPException(422, f"'{k}' must be a number, got '{v}'")
        return clean_in

    def classify(rows: list[dict]) -> list[dict]:
        model = bundle()["model"]
        proba = model.predict_proba(frame(rows))
        return [{"prediction": CLASSES[int(p.argmax())], "probabilities": {c: round(float(p[i]), 4) for i, c in enumerate(CLASSES)}} for p in proba]

    @app.get("/api/health", tags=["System"], summary="Health check", responses={200: {"content": {"application/json": {"example": {"status": "ok", "trained": True}}}}})
    def health():
        """Returns `ok`, and whether a trained model and report exist."""
        return {"status": "ok", "trained": (s.artifacts_dir / "report.json").exists()}

    @app.get("/api/branding", tags=["System"], summary="App name and logo",
             responses={200: {"content": {"application/json": {"example": {"name": "Wellbeing Lab", "tagline": "Social media usage and mental wellbeing", "logo_url": "/logo.svg"}}}}})
    def branding():
        """Name, tagline and logo used by the UI, from configuration."""
        return {"name": s.app_name, "tagline": s.app_tagline, "logo_url": s.logo_url}

    @app.get("/api/report", tags=["Results"], summary="Full analysis report")
    def full_report():
        """Everything computed by the last training run in one document: data profile, all models, threshold tuning, interpretation and findings."""
        return report()

    @app.get("/api/data/summary", tags=["Results"], summary="Dataset summary and cleaning log")
    def data_summary():
        """Rows, columns, how the wellbeing score was split into Low / Medium / High, what cleaning did, and which columns were excluded from the model and why."""
        r = report()
        return {**r["data"], "class_counts": r["eda"]["class_counts"], "rows": r["eda"]["rows"], "columns": r["eda"]["columns"]}

    @app.get("/api/eda", tags=["Results"], summary="Exploratory analysis")
    def eda():
        """Score distribution, missing values, correlations with the score, and the Low / Medium / High mix by hours of use, age, platform, late-night use and more."""
        return report()["eda"]

    @app.get("/api/models", tags=["Results"], summary="Model comparison",
             responses={200: {"content": {"application/json": {"example": {"best": {"key": "logreg", "name": "Logistic regression", "params": {"C": 10}, "cv_f1_macro": 0.6593}, "models": ["..."]}}}}})
    def models():
        """Six tuned classifiers (logistic regression, decision tree, KNN, random forest, linear SVM, RBF SVM) plus a majority-class baseline.
        Each row has the best hyper-parameters from 5-fold grid search, its cross-validated macro-F1, and metrics on the held-out test set.
        The best model is chosen on cross-validated macro-F1 only."""
        r = report()
        return {"best": r["best"], "models": r["models"], "final": r["final"]}

    @app.get("/api/threshold", tags=["Results"], summary="Decision-threshold tuning")
    def threshold():
        """Per-class probability weights searched on out-of-fold predictions, with the before / after test metrics, confusion matrices and whether the weights were adopted."""
        return report()["threshold"]

    @app.get("/api/insights", tags=["Results"], summary="What drives wellbeing")
    def insights():
        """Permutation importance of each input, how predicted risk moves with hours and notifications, the late-night effect, and the written findings."""
        r = report()
        return {"importance": r["importance"], "partial_dependence": r["partial_dependence"], "night_effect": r["night_effect"],
                "mediator_benchmark": r["mediator_benchmark"], "findings": r["findings"]}

    @app.get("/api/business-summary", tags=["Results"], summary="Business and public-policy summary")
    def business_summary():
        """Recommendations for responsible advertising and for public institutions, with the numbers they rest on."""
        return report()["business_summary"]

    @app.get("/api/predict/options", tags=["Predict"], summary="Inputs the model accepts")
    def predict_options():
        """Every input column with its allowed values (text columns) or its min, max and median (numeric columns), plus a typical starting value for each."""
        return report()["options"]

    @app.post("/api/predict", tags=["Predict"], summary="Predict one person's wellbeing group",
              responses={200: {"content": {"application/json": {"example": {"prediction": "Low", "probabilities": {"Low": 0.61, "Medium": 0.27, "High": 0.12},
                                                                                "what_if": [{"scenario": "One hour less per day", "prediction": "Medium", "probabilities": {"Low": 0.5, "Medium": 0.33, "High": 0.17}}]}}}}})
    def predict(body: PredictRequest):
        """Classify one person as Low, Medium or High wellbeing from the inputs given.
        The response also re-scores two what-if scenarios (one hour less per day, no late-night use) so you can see which change helps.
        This is a statistical association, not a diagnosis."""
        inputs = validate(body.inputs)
        base = classify([inputs])[0]
        scenarios, labels = [], []
        hours = inputs.get(s.hours_column)
        if hours is not None and hours > 1:
            scenarios.append({**inputs, s.hours_column: round(hours - 1, 1)})
            labels.append("One hour less per day")
        if inputs.get(s.night_column) == "Yes":
            scenarios.append({**inputs, s.night_column: "No"})
            labels.append("No late-night use")
        what_if = [{"scenario": lab, **res} for lab, res in zip(labels, classify(scenarios))] if scenarios else []
        return {**base, "what_if": what_if}

    @app.post("/api/predict/batch", tags=["Predict"], summary="Predict for a CSV of people")
    async def predict_batch(file: UploadFile = File(description="CSV with the same column names as the training data (any order; extra columns are ignored).")):
        """Score every row of an uploaded CSV. Returns the predicted group and the three probabilities per row, and a count of each group. At most 5,000 rows."""
        try:
            df = pd.read_csv(io.BytesIO(await file.read()))
        except Exception:
            raise HTTPException(400, "Could not read the file as CSV.")
        if len(df) > 5000:
            raise HTTPException(413, "At most 5,000 rows per request.")
        df.columns = [clean_name(c) for c in df.columns]
        known = bundle()["inputs"]
        if not set(df.columns) & set(known):
            raise HTTPException(422, f"No recognised columns. Expected some of: {known}")
        for c in report()["options"]["numeric"]:
            if c in df:
                df[c] = pd.to_numeric(df[c], errors="coerce")
        res = classify(df.reindex(columns=known).astype(object).where(df.reindex(columns=known).notna(), None).to_dict("records"))
        counts = {c: sum(r["prediction"] == c for r in res) for c in CLASSES}
        return {"rows": len(res), "counts": counts, "results": res}

    @app.post("/api/train", tags=["Training"], status_code=202, summary="Re-run the analysis",
              responses={202: {"content": {"application/json": {"example": {"job_id": "3f2c9a1e", "status": "running"}}}}})
    def train():
        """Starts the full pipeline (clean, engineer, grid-search six models, tune the threshold, interpret, save) as a background job.
        Poll `GET /api/jobs/{job_id}`. Takes about 10-60 seconds."""
        with lock:
            if any(j["status"] == "running" for j in jobs.values()):
                raise HTTPException(409, "A training run is already in progress.")
            job_id = uuid.uuid4().hex[:8]
            jobs[job_id] = {"id": job_id, "status": "running", "message": "Starting", "done": 0, "total": 8, "error": None}

        def work():
            def progress(msg, i, n):
                jobs[job_id].update(message=msg, done=i, total=n)
            try:
                pipeline.run(s, progress)
                jobs[job_id].update(status="done", message="Done", done=8)
            except Exception as e:  # reported to the client rather than lost in the thread
                jobs[job_id].update(status="failed", error=str(e))

        threading.Thread(target=work, daemon=True).start()
        return {"job_id": job_id, "status": "running"}

    @app.get("/api/jobs/{job_id}", tags=["Training"], summary="Training job progress", response_model=TrainJob)
    def job(job_id: str):
        """Status of a training run: `running`, `done` or `failed` (with `error`)."""
        if job_id not in jobs:
            raise HTTPException(404, "Unknown job")
        return jobs[job_id]

    return app


app = create_app()
