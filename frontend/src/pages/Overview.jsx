import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getReport } from "../api.js";
import { Chart, CLASSES, classColour } from "../charts.jsx";
import { ChartCard, Loaded, PageHeader, Section, Tile, TrainPanel, useLoad, f3 } from "../components.jsx";

export default function Overview() {
  const state = useLoad(getReport);
  return (
    <div>
      <PageHeader title="Overview" actions={state.data && <TrainPanel compact onDone={state.reload} />}>
        Is the time people spend on social media related to their mental wellbeing? A classification study on {state.data ? state.data.eda.rows.toLocaleString() : "survey"} respondents.
      </PageHeader>
      <Loaded state={state}>{(r) => <Body r={r} />}</Loaded>
    </div>
  );
}

function Body({ r }) {
  const { eda, final, best } = r;
  const h = eda.hours_vs_score;
  const bins = eda.by_hours;
  const lead = r.findings[0];
  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-card md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70">The short answer</p>
        <h2 className="mt-2 max-w-3xl text-xl font-semibold leading-snug tracking-tight md:text-2xl">
          Yes, they are related: people who spend more hours on social media are more likely to report low wellbeing.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/85">{lead.text}</p>
        <Link to="/insights" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-medium text-white no-underline backdrop-blur hover:bg-white/25">
          See what drives it <ArrowRight size={16} />
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Respondents analysed" value={eda.rows.toLocaleString()} note={`${r.data.train_rows} train · ${r.data.test_rows} test`} />
        <Tile label="Hours vs wellbeing" value={`ρ = ${h.spearman_rho}`} note="Spearman, p < 0.001" tone="bad" />
        <Tile label="Best model" value={best.name.replace(" (Gaussian / RBF kernel)", " (RBF)").replace(" (linear kernel)", " (linear)")} note={`CV macro-F1 ${f3(best.cv_f1_macro)}`} />
        <Tile label="Accuracy on unseen people" value={`${(final.test.accuracy * 100).toFixed(0)}%`} note={`macro-F1 ${f3(final.test.f1_macro)} · AUC ${f3(final.test.roc_auc_ovr)}`} tone="ok" />
      </div>

      <Section title="Wellbeing falls steadily as daily hours rise" hint={`Each respondent's score was split into thirds: Low (below ${r.data.cuts.low_below}), Medium, High (${r.data.cuts.high_from} and above). Bars show the mix of groups within each daily-hours band.`}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard title="Share of each wellbeing group by daily hours of use">
              <Chart
                label="Stacked bar chart: share of Low, Medium and High wellbeing by daily hours band"
                data={(t) => CLASSES.map((c) => ({
                  type: "bar", name: c, x: bins.map((b) => b.group), y: bins.map((b) => b[c.toLowerCase()]),
                  marker: { color: classColour(t, c), line: { width: 2, color: t.panel } },
                  hovertemplate: `${c}: %{y:.0f}%<extra></extra>`, text: bins.map((b) => `${b[c.toLowerCase()].toFixed(0)}%`), textposition: "inside", insidetextfont: { color: "#fff" },
                }))}
                layout={() => ({ barmode: "stack", yaxis: { title: { text: "% of respondents" }, range: [0, 100] }, xaxis: { title: { text: "Daily social media use" } } })}
              />
            </ChartCard>
          </div>
          <ChartCard title="Respondents per band" note="How many people each bar is based on.">
            <Chart
              label="Bar chart of respondents per daily hours band" height={300}
              data={(t) => [{ type: "bar", x: bins.map((b) => b.group), y: bins.map((b) => b.n), marker: { color: t.accent }, text: bins.map((b) => b.n), textposition: "outside", cliponaxis: false, hovertemplate: "%{y} people<extra></extra>" }]}
              layout={() => ({ yaxis: { title: { text: "People" } } })}
            />
          </ChartCard>
        </div>
      </Section>

      <Section title="Key findings">
        <div className="grid gap-4 md:grid-cols-2">
          {r.findings.slice(1).map((f) => (
            <div key={f.id} className="card my-0">
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
