import { getReport } from "../api.js";
import { Loaded, PageHeader, f3, useLoad } from "../components.jsx";

export default function Method() {
  const state = useLoad(getReport);
  return (
    <div>
      <PageHeader title="CRISP-DM method">How the study follows the Cross-Industry Standard Process for Data Mining, from business question to deployment.</PageHeader>
      <Loaded state={state}>{(r) => <Body r={r} />}</Loaded>
    </div>
  );
}

function Body({ r }) {
  const c = r.data.cleaning, cuts = r.data.cuts, best = r.models.find((m) => m.key === r.best.key);
  const steps = [
    ["1", "Business understanding", [
      "Question: is the time people spend on social media related to their mental wellbeing score?",
      "Treated as classification: the 0-10 wellbeing score becomes Low, Medium or High.",
      "Success means a model clearly better than guessing, plus findings a business or policy-maker can act on.",
    ]],
    ["2", "Data understanding", [
      `${c.rows_in.toLocaleString()} survey rows, ${r.eda.columns} columns: profile, usage, feelings about use, lifestyle and mental-state measures.`,
      `${c.duplicates_removed} duplicates and ${c.rows_without_score} rows without a score; ${c.missing_cells.toLocaleString()} blank cells remain (3-5% in most columns).`,
      `Hours of use and score: Spearman ρ = ${r.eda.hours_vs_score.spearman_rho}. Late-night use shows a bigger gap.`,
    ]],
    ["3", "Data preparation", [
      `Target: scores below ${cuts.low_below} are Low, ${cuts.high_from} and above are High, the rest Medium (thirds around the median of ${cuts.median}).`,
      "Excluded from inputs: user id; Addiction_Level (derived from usage itself, so it would answer the question for the model); five mental-state measures (outcomes, not behaviour).",
      "Engineered: late-night hours (hours × late-night use), notifications per hour, age group. Missing values are filled and scaled inside each cross-validation fold.",
      `Critical subset: the ${r.data.features_kept} most informative columns by ANOVA F-test, chosen inside each fold. Stratified ${100 - r.data.settings.test_size * 100}/${r.data.settings.test_size * 100} train/test split, seed ${r.data.settings.random_state}.`,
    ]],
    ["4", "Modelling", [
      "Logistic regression, decision tree, K-nearest neighbours, random forest and SVMs with linear and Gaussian (RBF) kernels, plus a majority-class baseline.",
      `Hyper-parameters tuned by ${r.data.settings.cv_folds}-fold stratified grid search on macro-F1.`,
      `Best model: ${best.name} with ${Object.entries(best.best_params).map(([k, v]) => `${k} = ${v ?? "None"}`).join(", ")}.`,
    ]],
    ["5", "Evaluation", [
      "The winner is picked on cross-validated macro-F1 from training data only; the test set is scored once.",
      `Held-out test: macro-F1 ${f3(r.final.test.f1_macro)}, accuracy ${f3(r.final.test.accuracy)}, ROC AUC ${f3(r.final.test.roc_auc_ovr)}; the baseline gets macro-F1 ${f3(r.models[0].test.f1_macro)}.`,
      `Improvement: per-class decision-threshold tuning on out-of-fold probabilities. ${r.threshold.adopted ? "Adopted." : "Not adopted: the gain was within noise."}`,
      "Interpretation: permutation importance, predicted-risk curves and group profiles.",
    ]],
    ["6", "Deployment", [
      "FastAPI service with documented endpoints (see API docs) for results, single and batch prediction, and re-training.",
      "This web interface reads the same API.",
      "Business and policy recommendations are generated from the measured results.",
    ]],
  ];
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-6">
      {steps.map(([n, title, items]) => (
        <li key={n} className="relative">
          <span className="absolute -left-[41px] grid size-8 place-items-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-card">{n}</span>
          <div className="card my-0">
            <h2 className="font-semibold tracking-tight">{title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-accent">{items.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
