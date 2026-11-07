import joblib
import numpy as np

from wellbeing.data import CLASSES


def test_all_six_models_and_a_baseline_are_compared(trained):
    keys = [m["key"] for m in trained["models"]]
    assert keys == ["baseline", "logreg", "tree", "knn", "forest", "svm_linear", "svm_rbf"]
    for m in trained["models"][1:]:
        assert m["best_params"] and 0 < m["cv_f1_macro"] < 1 and "f1_macro" in m["test"]


def test_best_model_is_chosen_on_cross_validation_not_test(trained):
    cv_best = max(trained["models"][1:], key=lambda m: m["cv_f1_macro"])
    assert trained["best"]["key"] == cv_best["key"]
    assert trained["best"]["params"] == cv_best["best_params"]


def test_model_beats_the_majority_baseline(trained):
    assert trained["final"]["test"]["f1_macro"] > trained["models"][0]["test"]["f1_macro"] + 0.1


def test_threshold_weights_are_per_class_and_only_adopted_on_a_clear_gain(trained):
    t = trained["threshold"]
    assert set(t["weights"]) == set(CLASSES) and t["weights"]["Medium"] == 1.0
    assert t["adopted"] == (t["oof_f1_tuned"] > t["oof_f1_default"] + 0.01)
    assert np.array(t["confusion_default"]).sum() == trained["data"]["test_rows"]


def test_hours_and_wellbeing_are_negatively_related_in_the_report(trained):
    assert trained["eda"]["hours_vs_score"]["spearman_rho"] < -0.3
    low = [b["low"] for b in trained["eda"]["by_hours"]]
    assert low[-1] > low[0]


def test_importance_uses_raw_inputs_and_finds_the_planted_drivers(trained):
    top = [i["feature"] for i in trained["importance"][:4]]
    assert "daily_usage_hours" in top


def test_partial_dependence_probabilities_sum_to_100(trained):
    pd_ = trained["partial_dependence"]["hours"]
    for i in range(len(pd_["grid"])):
        assert abs(sum(pd_["prob_pct"][c][i] for c in CLASSES) - 100) < 0.5


def test_saved_model_predicts_probabilities_in_class_order(settings, trained):
    b = joblib.load(settings.artifacts_dir / "model.joblib")
    assert b["classes"] == CLASSES
    import pandas as pd
    X = pd.DataFrame([{c: np.nan for c in b["inputs"]}])
    p = b["model"].predict_proba(X)
    assert p.shape == (1, 3) and abs(p.sum() - 1) < 1e-6


def test_findings_and_business_summary_are_generated_from_the_numbers(trained):
    assert {f["id"] for f in trained["findings"]} >= {"hours", "night", "drivers", "caveat"}
    assert str(trained["eda"]["hours_vs_score"]["spearman_rho"]) in trained["findings"][0]["text"]
    bs = trained["business_summary"]
    assert len(bs["business"]) >= 3 and len(bs["public"]) >= 3 and "association" in bs["limits"]
