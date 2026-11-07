import { useCallback, useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { startTraining, watchJob } from "./api.js";

// Company logo from config; falls back to the first letter of the name if there is no logo or it fails to load.
export function Logo({ branding, size = "size-8" }) {
  const [broken, setBroken] = useState(false);
  if (branding.logo_url && !broken) {
    return <img src={branding.logo_url} alt="" className={`${size} rounded-lg object-contain`} onError={() => setBroken(true)} />;
  }
  return <span className={`${size} grid place-items-center rounded-lg bg-accent font-bold text-white`}>{branding.name.charAt(0)}</span>;
}

export const PageHeader = ({ title, children, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="hint mt-1 max-w-3xl">{children}</p>}
    </div>
    {actions}
  </div>
);

export function Section({ title, hint, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && <p className="hint mb-4 max-w-3xl">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function Tile({ label, value, note, tone }) {
  return (
    <div className="card my-0 min-w-0">
      <p className="hint truncate">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : ""}`}>{value}</p>
      {note && <p className="hint truncate" title={note}>{note}</p>}
    </div>
  );
}

export function ChartCard({ title, note, children }) {
  return (
    <div className="card my-0 min-w-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {note && <p className="hint mb-1">{note}</p>}
      {children}
    </div>
  );
}

export const Alert = ({ children }) => <p className="my-3 rounded-xl border border-bad/30 bg-bad/10 p-3 text-bad" role="alert">{children}</p>;

export const Note = ({ children }) => <p className="my-3 rounded-xl border border-accent/25 bg-soft p-3 text-sm">{children}</p>;

// Loads data once; `error.status === 404` means "no trained model yet" and shows the training panel instead.
export function useLoad(fn) {
  const [state, setState] = useState({ data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((data) => live && setState({ data, error: null })).catch((error) => live && setState({ data: null, error }));
    return () => { live = false; };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function Loaded({ state, children }) {
  if (state.error?.status === 404) return <TrainPanel onDone={state.reload} first />;
  if (state.error) return <Alert>{state.error.message}</Alert>;
  if (!state.data) return <p className="hint">Loading…</p>;
  return children(state.data);
}

// Starts the training job and shows its progress.
export function TrainPanel({ onDone, first = false, compact = false }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const running = job?.status === "running";

  async function run() {
    setError("");
    setJob({ status: "running", message: "Starting", done: 0, total: 8 });
    try {
      const { job_id } = await startTraining();
      const done = await watchJob(job_id, setJob);
      if (done.status === "failed") throw new Error(done.error);
      setJob(null);
      onDone?.();
    } catch (e) {
      setError(e.message);
      setJob(null);
    }
  }
  const button = (
    <button className="btn inline-flex items-center gap-2" disabled={running} onClick={run}>
      {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{running ? "Running" : first ? "Run the analysis" : "Re-run analysis"}
    </button>
  );
  const progress = running && (
    <div className="mt-3 w-full max-w-md" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-linear-to-r from-indigo-600 to-violet-600 transition-all" style={{ width: `${Math.max(6, (job.done / job.total) * 100)}%` }} /></div>
      <p className="hint mt-1">{job.message}</p>
    </div>
  );
  if (compact) return <div className="text-right">{button}{progress}{error && <p className="hint text-bad">{error}</p>}</div>;
  return (
    <div className="card text-center">
      <h2 className="text-lg font-semibold">{first ? "No results yet" : "Re-run the analysis"}</h2>
      <p className="hint mx-auto mb-4 mt-1 max-w-lg">Cleans the data, tunes six models with grid search, picks the best, tunes its decision threshold and writes the report. It takes under a minute.</p>
      {button}
      <div className="mx-auto flex justify-center">{progress}</div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

export const ClassChip = ({ name }) => {
  const style = { Low: "bg-s2/15 text-s2", Medium: "bg-s4/20 text-ink", High: "bg-s1/15 text-s1" }[name];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{name}</span>;
};

export const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
export const f3 = (v) => (v == null ? "–" : v.toFixed(3));

export function CodeBlock({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-code p-3 pr-16 text-xs leading-relaxed text-slate-200">{text}</pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded bg-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/20">{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}
