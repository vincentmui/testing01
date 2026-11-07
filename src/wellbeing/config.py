from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration lives here; values come from the environment or .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Wellbeing Lab"
    app_tagline: str = "Social media usage and mental wellbeing"
    logo_url: str = "/logo.svg"

    data_file: Path = Path("data/social_media_addiction_mental_wellbeing.csv")
    artifacts_dir: Path = Path("artifacts")  # trained model + report.json

    # Column names after cleaning (lower snake_case)
    score_column: str = "mental_wellbeing_score"
    hours_column: str = "daily_usage_hours"
    age_column: str = "age"
    night_column: str = "late_night_usage"  # Yes / No
    id_columns: list[str] = ["user_id"]
    # Derived from usage itself, so it would leak the answer to "does usage matter?"
    derived_columns: list[str] = ["addiction_level"]
    # Measures of mental state, i.e. outcomes of wellbeing rather than social media behaviour.
    # Kept out of the main model; used only for the "with mediators" benchmark.
    mediator_columns: list[str] = ["anxiety_score", "depression_score", "loneliness_score", "self_esteem_score", "sleep_quality_score"]
    categorical_columns: list[str] = [
        "gender", "occupation", "relationship_status", "primary_platform", "late_night_usage",
        "first_check_morning", "tried_to_cut_back", "failed_to_cut_back",
    ]

    low_quantile: float = 1 / 3  # score below this quantile = Low; above (1 - this) = High; between = Medium
    test_size: float = 0.25
    cv_folds: int = 5
    n_features: int = 20  # size of the critical-feature subset kept after feature engineering
    random_state: int = 42
    n_jobs: int = -1
    quick: bool = False  # a small grid, for tests and a fast first run


@lru_cache
def get_settings() -> Settings:
    return Settings()
