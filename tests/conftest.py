import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from wellbeing.config import Settings
from wellbeing.main import create_app


def make_frame(n=400, seed=1) -> pd.DataFrame:
    """A small made-up survey in the shape of the real file, with a built-in hours -> wellbeing link and some missing cells."""
    rng = np.random.default_rng(seed)
    hours = rng.gamma(4, 1.1, n).round(1)
    night = rng.choice(["Yes", "No"], n)
    fail = rng.choice(["Yes", "No"], n)
    score = 8 - 0.35 * hours - 0.9 * (night == "Yes") - 0.7 * (fail == "Yes") + rng.normal(0, 0.8, n)
    df = pd.DataFrame({
        "User_ID": [f"U{i}" for i in range(n)], "Age": rng.integers(15, 45, n), "Gender": rng.choice(["Female", "Male", "Non-binary"], n),
        "Occupation": rng.choice(["Student", "Freelancer"], n), "Relationship_Status": rng.choice(["Single", "Married"], n),
        "Primary_Platform": rng.choice(["TikTok", "YouTube", "Facebook"], n), "Daily_Usage_Hours": hours,
        "Platforms_Used_Count": rng.integers(1, 6, n), "Posts_Per_Week": rng.integers(0, 9, n), "Late_Night_Usage": night,
        "First_Check_Morning": rng.choice(["Within 5 min", "5-30 min", "After 30 min"], n), "Notifications_Per_Day": rng.integers(5, 150, n),
        "FOMO_Score": rng.uniform(0, 10, n).round(1), "Scroll_Without_Purpose": rng.uniform(0, 10, n).round(1),
        "Tried_To_Cut_Back": rng.choice(["Yes", "No"], n), "Failed_To_Cut_Back": fail,
        "Anxiety_Score": (10 - score + rng.normal(0, 1, n)).round(1), "Depression_Score": rng.uniform(0, 10, n).round(1),
        "Loneliness_Score": rng.uniform(0, 10, n).round(1), "Self_Esteem_Score": rng.uniform(0, 10, n).round(1), "Sleep_Quality_Score": rng.uniform(0, 10, n).round(1),
        "Mental_Wellbeing_Score": score.round(1), "Addiction_Level": np.where(hours > 5, "High", "Low"),
    })
    for c in ["Gender", "Late_Night_Usage", "Daily_Usage_Hours", "FOMO_Score"]:
        df.loc[rng.random(n) < 0.04, c] = np.nan
    return df


@pytest.fixture(scope="session")
def settings(tmp_path_factory) -> Settings:
    d = tmp_path_factory.mktemp("w")
    make_frame().to_csv(d / "survey.csv", index=False)
    return Settings(data_file=d / "survey.csv", artifacts_dir=d / "artifacts", quick=True, cv_folds=3, n_features=10, n_jobs=1)


@pytest.fixture
def raw(settings) -> pd.DataFrame:
    return pd.read_csv(settings.data_file)


@pytest.fixture(scope="session")
def trained(settings):
    from wellbeing.pipeline import run
    return run(settings)


@pytest.fixture
def client(settings, trained):
    return TestClient(create_app(settings))


@pytest.fixture
def untrained_client(tmp_path, settings):
    return TestClient(create_app(settings.model_copy(update={"artifacts_dir": tmp_path / "none"})))
