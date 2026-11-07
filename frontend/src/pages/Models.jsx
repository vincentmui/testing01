import { useState } from "react";
import { getReport } from "../api.js";
import { Chart } from "../charts.jsx";
import { ChartCard, ClassChip, Loaded, Note, PageHeader, Section, Tile, TrainPanel, f3, useLoad } from "../components.jsx";

const CLASSES = ["Low", "Medium", "High"];
const COLS = [["accuracy", "Accuracy"], ["precision_macro", "Precision"], ["recall_macro", "Recall"], ["f1_macro", "Macro-F1"], ["roc_auc_ovr", "ROC AUC"]];

export default function Models() {
  const state = useLoad(getReport);
  return (
    <div>
      <PageHeader title="Models" actions={state.data && <TrainPanel compact onDone={state.reload} />}>
        Modelling and evaluation: six classifiers tuned with 5-fold grid search on the training data, then scored once on people the models never saw.
      </PageHeader>
      <Loaded state={state}>{(r) => <Body r={r} />}</Loaded>
    </div>
  );
}

function Body({ r }) {
  const models = r.models;
  const best = models.find((m) => m.key === r.best.key);
  const base = models[0];
  return (
    <>
      <div className="mb-6 overflow-hidden rounded-2xl border border-accent/30 bg-soft p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent">Best model</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{best.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(best.best_params).map(([k, v]) => <span key={k} className="chip !mr-0 py-1 font-mono text-sm">{k} = {String(v ?? "None")}</span>)}
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Chosen because it has the highest cross-validated macro-F1 ({f3(best.cv_f1_macro)} ± {f3(best.cv_f1_std)}) on the training data. The test set played no part in the choice.
          On {r.data.test_rows} unseen people it reaches macro-F1 {f3(best.test.f1_macro)} and ROC AUC {f3(best.test.roc_auc_ovr)}, against {f3(base.test.f1_macro)} for always guessing the biggest group.
        </p>
      </div>

      <Section title="Model comparison" hint="Macro-F1 averages the F1 of Low, Medium and High equally, so a model cannot look good by ignoring the middle group. CV = 5-fold cross-validation on the training data; test = held-out people.">
        <div className="mb-4 overflow-x-auto rounded-2xl border border-line bg-panel shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-bg text-left text-xs uppercase tracking-wider text-muted">
              <tr className="[&>th]:px-4 [&>th]:py-3"><th>Model</th><th>Best hyper-parameters</th><th>CV macro-F1</th>{COLS.map(([, l]) => <th key={l}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.key} className={`border-t border-line [&>td]:px-4 [&>td]:py-3 ${m.key === r.best.key ? "bg-soft/60 font-medium" : ""}`}>
                  <td className="whitespace-nowrap">{m.name}{m.key === r.best.key && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-white">best</span>}</td>
                  <td className="font-mono text-xs text-muted">{Object.entries(m.best_params).map(([k, v]) => `${k}=${v ?? "None"}`).join(", ") || "–"}</td>
                  <td className="tabular-nums">{f3(m.cv_f1_macro)}</td>
                  {COLS.map(([k]) => <td key={k} className="tabular-nums">{f3(m.test[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ChartCard title="Cross-validated vs test macro-F1">
          <Chart
            label="Grouped bar chart of cross-validated and test macro-F1 for each model" height={340}
            data={(t) => [
              { type: "bar", name: "Cross-validated (training)", x: models.slice(1).map((m) => m.name), y: models.slice(1).map((m) => m.cv_f1_macro), marker: { color: t.s1 }, text: models.slice(1).map((m) => f3(m.cv_f1_macro)), textposition: "outside", cliponaxis: false },
              { type: "bar", name: "Held-out test", x: models.slice(1).map((m) => m.name), y: models.slice(1).map((m) => m.test.f1_macro), marker: { color: t.s2 }, text: models.slice(1).map((m) => f3(m.test.f1_macro)), textposition: "outside", cliponaxis: false },
            ]}
            layout={() => ({ barmode: "group", yaxis: { title: { text: "Macro-F1" }, range: [0, 0.85] }, xaxis: { tickangle: 0 } })}
          />
        </ChartCard>
      </Section>

      <Threshold r={r} />
    </>
  );
}

function Threshold({ r }) {
  const t = r.threshold;
  const [view, setView] = useState(t.adopted ? "tuned" : "default");
  const cm = view === "tuned" ? t.confusion_tuned : t.confusion_default;
  const rows = view === "tuned" ? t.per_class_tuned : t.per_class_default;
  const d = t.test_default.f1_macro, u = t.test_tuned.f1_macro;
  return (
    <Section title="Improving the best model: decision-threshold tuning" hint="With three classes, the 'threshold' is a weight on each class's probability before picking the largest. Weights were searched on out-of-fold predictions from the training data only.">
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CLASSES.map((c) => <Tile key={c} label={`${c} weight`} value={t.weights[c].toFixed(1)} note={c === "Medium" ? "reference" : "searched 0.6 to 1.8"} />)}
        <Tile label="Out-of-fold macro-F1" value={`${f3(t.oof_f1_default)} → ${f3(t.oof_f1_tuned)}`} note="training data, 5-fold" tone={t.adopted ? "ok" : undefined} />
      </div>
      <Note>
        {t.adopted
          ? `The tuned weights raised out-of-fold macro-F1 by more than one point, so they are used in the final model. Test macro-F1: ${f3(d)} → ${f3(u)}.`
          : `Tuning gained under one point of out-of-fold macro-F1 (${f3(t.oof_f1_default)} → ${f3(t.oof_f1_tuned)}), which is within noise, so the standard argmax rule is kept. For reference, the tuned weights give test macro-F1 ${f3(u)} vs ${f3(d)} untuned.`}
        {" "}The Medium group is the hardest to tell apart because it sits between the other two.
      </Note>
      <div className="mb-3 flex gap-2" role="tablist">
        {[["default", "Standard rule"], ["tuned", "Tuned weights"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition ${view === k ? "border-accent bg-soft font-medium text-accent" : "border-line bg-panel text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Confusion matrix (test set)" note="Rows are the true group, columns the predicted group.">
          <Chart
            label="Confusion matrix heatmap of true versus predicted wellbeing group" height={320}
            data={(th) => [{
              type: "heatmap", x: CLASSES, y: CLASSES, z: cm, colorscale: [[0, th.panel], [1, th.accent]], showscale: false,
              text: cm.map((row) => row.map(String)), texttemplate: "%{text}", textfont: { size: 16 }, hovertemplate: "true %{y}, predicted %{x}: %{z}<extra></extra>",
            }]}
            layout={() => ({ xaxis: { title: { text: "Predicted" }, side: "bottom" }, yaxis: { title: { text: "True" }, autorange: "reversed" } })}
          />
        </ChartCard>
        <ChartCard title="Per-group results (test set)">
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted"><tr className="[&>th]:py-2"><th>Group</th><th>Precision</th><th>Recall</th><th>F1</th><th>People</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.class} className="border-t border-line [&>td]:py-2.5"><td><ClassChip name={p.class} /></td><td className="tabular-nums">{p.precision.toFixed(2)}</td><td className="tabular-nums">{p.recall.toFixed(2)}</td><td className="tabular-nums">{p.f1.toFixed(2)}</td><td className="tabular-nums text-muted">{p.support}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="hint mt-3">Precision: of the people predicted in this group, how many truly are. Recall: of the people truly in it, how many were found.</p>
        </ChartCard>
      </div>
      <p className="hint mt-4">
        Benchmark: adding the five mental-state measures (anxiety, depression, loneliness, self-esteem, sleep quality) raises test macro-F1 from {f3(r.mediator_benchmark.without.f1_macro)} to {f3(r.mediator_benchmark.test.f1_macro)}.
        They are excluded from the main model because they measure wellbeing rather than social media behaviour.
      </p>
    </Section>
  );
}
