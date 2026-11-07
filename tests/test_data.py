import numpy as np

from wellbeing import data
from wellbeing.data import CLASSES, TARGET, feature_frame, prepare
from wellbeing.features import Engineer


def test_target_is_three_roughly_equal_groups(settings):
    df, info = prepare(settings)
    counts = df[TARGET].value_counts(normalize=True)
    assert set(counts.index) == set(CLASSES)
    assert counts.between(0.28, 0.38).all()
    # thresholds order the score: every Low is below every High
    assert df.loc[df[TARGET] == "Low", settings.score_column].max() < df.loc[df[TARGET] == "High", settings.score_column].min()
    assert info["cuts"]["low_below"] < info["cuts"]["median"] < info["cuts"]["high_from"]


def test_cleaning_drops_rows_without_score_and_duplicates(settings, raw):
    raw = raw.copy()
    raw.loc[0, "Mental_Wellbeing_Score"] = np.nan
    import pandas as pd
    raw = pd.concat([raw, raw.iloc[5:6].assign(User_ID="DUP")])  # same answers, different id
    raw.columns = [data.clean_name(c) for c in raw.columns]
    out, log = data.clean(raw, settings)
    assert log["rows_without_score"] == 1 and log["duplicates_removed"] == 1
    assert out[settings.score_column].notna().all()


def test_model_inputs_exclude_leaky_columns(settings):
    df, _ = prepare(settings)
    cols = set(feature_frame(df, settings).columns)
    assert not cols & {"user_id", "addiction_level", "mental_wellbeing_score", TARGET, *settings.mediator_columns}
    assert set(settings.mediator_columns) <= set(feature_frame(df, settings, mediators=True).columns)


def test_engineer_adds_night_hours_and_handles_missing():
    import pandas as pd
    X = pd.DataFrame({"daily_usage_hours": [2.0, 3.0, 4.0], "late_night_usage": ["Yes", "No", np.nan], "age": [16, 40, np.nan], "notifications_per_day": [10, 20, 30]})
    out = Engineer().transform(X)
    assert out["night_hours"].tolist()[0] == 2.0 and out["night_hours"].tolist()[1] == 0.0 and np.isnan(out["night_hours"].iloc[2])
    assert out["age_group"].tolist()[:2] == ["under 18", "35+"]
