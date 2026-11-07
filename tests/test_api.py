def test_health_and_branding(client):
    assert client.get("/api/health").json() == {"status": "ok", "trained": True}
    assert client.get("/api/branding").json()["name"] == "Wellbeing Lab"


def test_results_endpoints(client):
    assert client.get("/api/models").json()["best"]["name"]
    assert client.get("/api/eda").json()["class_counts"]
    assert client.get("/api/threshold").json()["weights"]
    assert client.get("/api/insights").json()["findings"]
    assert client.get("/api/business-summary").json()["business"]
    d = client.get("/api/data/summary").json()
    assert d["rows"] > 300 and "addiction_level" in d["excluded"]["derived"]


def test_untrained_server_says_what_to_do(untrained_client):
    r = untrained_client.get("/api/models")
    assert r.status_code == 404 and "POST /api/train" in r.json()["detail"]
    assert untrained_client.get("/api/health").json()["trained"] is False


def test_predict_returns_probabilities_and_what_if(client):
    r = client.post("/api/predict", json={"inputs": {"daily_usage_hours": 8, "late_night_usage": "Yes", "failed_to_cut_back": "Yes"}}).json()
    assert r["prediction"] in ("Low", "Medium", "High")
    assert abs(sum(r["probabilities"].values()) - 1) < 1e-3
    assert [w["scenario"] for w in r["what_if"]] == ["One hour less per day", "No late-night use"]


def test_heavy_late_night_use_scores_worse_than_light_daytime_use(client):
    heavy = client.post("/api/predict", json={"inputs": {"daily_usage_hours": 10, "late_night_usage": "Yes", "failed_to_cut_back": "Yes"}}).json()
    light = client.post("/api/predict", json={"inputs": {"daily_usage_hours": 1, "late_night_usage": "No", "failed_to_cut_back": "No"}}).json()
    assert heavy["probabilities"]["Low"] > light["probabilities"]["Low"]
    assert light["probabilities"]["High"] > heavy["probabilities"]["High"]


def test_predict_rejects_bad_input(client):
    assert client.post("/api/predict", json={"inputs": {"nope": 1}}).status_code == 422
    assert client.post("/api/predict", json={"inputs": {"gender": "Robot"}}).status_code == 422
    assert client.post("/api/predict", json={"inputs": {"daily_usage_hours": "lots"}}).status_code == 422


def test_batch_prediction(client, settings):
    with open(settings.data_file, "rb") as f:
        r = client.post("/api/predict/batch", files={"file": ("survey.csv", f, "text/csv")}).json()
    assert r["rows"] == 400 and sum(r["counts"].values()) == 400
    assert client.post("/api/predict/batch", files={"file": ("x.csv", b"foo,bar\n1,2\n", "text/csv")}).status_code == 422


def test_training_job_runs_in_background(settings, tmp_path):
    import time
    from fastapi.testclient import TestClient
    from wellbeing.main import create_app
    c = TestClient(create_app(settings.model_copy(update={"artifacts_dir": tmp_path / "fresh"})))
    job = c.post("/api/train").json()["job_id"]
    for _ in range(120):
        j = c.get(f"/api/jobs/{job}").json()
        if j["status"] != "running":
            break
        time.sleep(0.5)
    assert j["status"] == "done", j
    assert c.get("/api/health").json()["trained"] is True
    assert c.get("/api/jobs/zzz").status_code == 404


def test_openapi_documents_every_endpoint(client):
    spec = client.get("/api/openapi.json").json()
    for path, methods in spec["paths"].items():
        for m, op in methods.items():
            assert op.get("summary") and op.get("tags"), f"{m} {path} lacks a summary or tag"
    assert client.get("/api/docs").status_code == 200


def test_options_give_typical_starting_values(client):
    o = client.get("/api/predict/options").json()
    assert set(o["typical"]) == set(o["numeric"]) | set(o["categorical"])
    assert o["typical"]["late_night_usage"] in o["categorical"]["late_night_usage"]
