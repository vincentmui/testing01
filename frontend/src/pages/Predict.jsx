import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, UploadCloud } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getOptions, predict, predictBatch } from "../api.js";
import { Alert, ClassChip, Loaded, PageHeader, Section, useLoad } from "../components.jsx";

const GROUPS = [
  { title: "Use of social media", fields: ["daily_usage_hours", "late_night_usage", "first_check_morning", "notifications_per_day", "platforms_used_count", "posts_per_week", "primary_platform", "scroll_without_purpose", "tried_to_cut_back", "failed_to_cut_back"] },
  { title: "Feelings about use", fields: ["fomo_score", "social_comparison_score", "validation_seeking_score", "productivity_loss_score"] },
  { title: "Lifestyle", fields: ["offline_relationship_quality", "sleep_hours", "physical_activity_hrs_week", "screen_free_time_hrs"] },
  { title: "About the person", fields: ["age", "gender", "occupation", "relationship_status"] },
];
const nice = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()).replace(" hrs", " (hours)");
const PRESETS = {
  "Light daytime use": { daily_usage_hours: 1.5, late_night_usage: "No", first_check_morning: "After 30 min", failed_to_cut_back: "No", notifications_per_day: 20, fomo_score: 2, scroll_without_purpose: 2 },
  "Heavy late-night use": { daily_usage_hours: 8, late_night_usage: "Yes", first_check_morning: "Within 5 min", failed_to_cut_back: "Yes", notifications_per_day: 110, fomo_score: 8, scroll_without_purpose: 8 },
};

export default function Predict() {
  const state = useLoad(getOptions);
  return (
    <div>
      <PageHeader title="Predict a wellbeing group">Describe a person's social media habits and see which group (Low, Medium, High) the model expects, with the chance of each. This is a statistical pattern, not a diagnosis.</PageHeader>
      <Loaded state={state}>{(o) => <><Form o={o} /><Batch /></>}</Loaded>
    </div>
  );
}

function Form({ o }) {
  const typical = o.typical;
  const [params] = useSearchParams(); // /predict?preset=Heavy late-night use opens with that preset, handy for links and the docs
  const [values, setValues] = useState({ ...typical, ...PRESETS[params.get("preset")] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const timer = setTimeout(() => {
      const inputs = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v != null));
      predict(inputs).then((r) => id === seq.current && (setResult(r), setError(""))).catch((e) => id === seq.current && setError(e.message));
    }, 200); // wait for the slider to settle
    return () => clearTimeout(timer);
  }, [values]);

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));
  const known = (k) => k in o.numeric || k in o.categorical;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="hint">Start from:</span>
          {Object.entries(PRESETS).map(([name, p]) => <button key={name} className="cursor-pointer rounded-full border border-line bg-panel px-3 py-1 text-sm text-muted transition hover:border-accent hover:text-accent" onClick={() => setValues({ ...typical, ...p })}>{name}</button>)}
          <button className="ml-auto inline-flex cursor-pointer items-center gap-1.5 px-1.5 text-sm text-muted hover:text-accent" onClick={() => setValues(typical)}><RotateCcw size={14} /> Typical</button>
        </div>
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="card">
            <legend className="px-1 text-sm font-semibold">{g.title}</legend>
            <div className="mt-1 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {g.fields.filter(known).map((k) => o.numeric[k] ? (
                <label key={k} className="block text-sm">
                  <span className="flex justify-between"><span>{nice(k)}</span><b className="tabular-nums text-accent">{values[k]}</b></span>
                  <input type="range" className="mt-1 w-full accent-[var(--accent)]" min={Math.floor(o.numeric[k].min)} max={Math.ceil(o.numeric[k].max)} step={o.numeric[k].max <= 12 ? 0.1 : 1} value={values[k] ?? o.numeric[k].median} onChange={(e) => set(k, Number(e.target.value))} />
                </label>
              ) : (
                <label key={k} className="block text-sm"><span>{nice(k)}</span>
                  <select className="field mt-1 !py-1.5" value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
                    <option value="">Not specified</option>
                    {o.categorical[k].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="lg:col-span-2"><div className="sticky top-24"><Result result={result} error={error} /></div></div>
    </div>
  );
}

const BAR = { Low: "bg-s2", Medium: "bg-s4", High: "bg-s1" };

function Result({ result, error }) {
  if (error) return <Alert>{error}</Alert>;
  if (!result) return <p className="hint">Predicting…</p>;
  const p = result.probabilities;
  return (
    <div className="card my-0" aria-live="polite">
      <p className="hint">Expected wellbeing group</p>
      <p className="mt-1 flex items-center gap-3"><span className="text-3xl font-semibold tracking-tight">{result.prediction}</span><ClassChip name={result.prediction} /></p>
      <div className="mt-4 space-y-2.5">
        {["Low", "Medium", "High"].map((c) => (
          <div key={c}>
            <div className="flex justify-between text-sm"><span>{c}</span><b className="tabular-nums">{(p[c] * 100).toFixed(0)}%</b></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full transition-all ${BAR[c]}`} style={{ width: `${p[c] * 100}%` }} /></div>
          </div>
        ))}
      </div>
      {result.what_if.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">What if…</h3>
          <div className="mt-2 space-y-2">
            {result.what_if.map((w) => {
              const delta = (w.probabilities.Low - p.Low) * 100;
              return (
                <div key={w.scenario} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
                  <span>{w.scenario}</span>
                  <span className="text-right"><b>{(w.probabilities.Low * 100).toFixed(0)}% Low</b> <span className={`text-xs ${delta < 0 ? "text-ok" : "text-bad"}`}>{delta > 0 ? "+" : ""}{delta.toFixed(0)} pts</span></span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Batch() {
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef();

  async function upload(file) {
    if (!file) return;
    setError(""); setRes(null);
    try { setRes(await predictBatch(file)); } catch (e) { setError(e.message); }
  }
  const csv = () => {
    const rows = ["row,prediction,low,medium,high", ...res.results.map((r, i) => `${i + 1},${r.prediction},${r.probabilities.Low},${r.probabilities.Medium},${r.probabilities.High}`)];
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" })), download: "predictions.csv" });
    a.click();
  };

  return (
    <Section title="Score a file" hint="Upload a CSV with the same columns as the survey (up to 5,000 rows) to classify everyone at once.">
      <div
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-accent hover:bg-soft ${over ? "border-accent bg-soft" : "border-line bg-panel"}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]); }}
        onClick={() => input.current.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current.click()}
      >
        <UploadCloud size={30} className="mx-auto mb-2 text-accent" strokeWidth={1.5} />
        <p className="font-medium">Drop a CSV here, or click to choose</p>
        <input ref={input} type="file" accept=".csv" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
      </div>
      {error && <Alert>{error}</Alert>}
      {res && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            <b>{res.rows.toLocaleString()} people scored</b>
            {["Low", "Medium", "High"].map((c) => <span key={c} className="flex items-center gap-1.5 text-sm"><ClassChip name={c} /> {res.counts[c]} <span className="text-muted">({((res.counts[c] / res.rows) * 100).toFixed(0)}%)</span></span>)}
            <button className="btn ml-auto inline-flex items-center gap-2 !py-1.5 text-sm" onClick={csv}><Download size={15} /> Download results</button>
          </div>
        </div>
      )}
    </Section>
  );
}
