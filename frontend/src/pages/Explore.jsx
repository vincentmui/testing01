import { useState } from "react";
import { getEda } from "../api.js";
import { Chart, CLASSES, classColour } from "../charts.jsx";
import { ChartCard, Loaded, PageHeader, Section, Tile, useLoad } from "../components.jsx";

const SEGMENTS = [
  { key: "by_hours", label: "Daily hours" }, { key: "by_night", label: "Late-night use" }, { key: "by_age", label: "Age group" },
  { key: "by_platform", label: "Main platform" }, { key: "by_gender", label: "Gender" }, { key: "by_occupation", label: "Occupation" }, { key: "by_relationship", label: "Relationship" },
];
const nice = (s) => s.replace(/_/g, " ");

export default function Explore() {
  const state = useLoad(getEda);
  return (
    <div>
      <PageHeader title="Explore the data">Business and data understanding: what is in the survey, how clean it is, and how wellbeing varies across groups before any model is fitted.</PageHeader>
      <Loaded state={state}>{(e) => <Body e={e} />}</Loaded>
    </div>
  );
}

function Body({ e }) {
  const [seg, setSeg] = useState("by_hours");
  const rows = e[seg];
  const noise = e.correlations.filter((c) => !c.mediator);
  const total = e.rows;
  return (
    <>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Rows" value={e.rows.toLocaleString()} note="after cleaning" />
        <Tile label="Columns" value={e.columns} />
        {CLASSES.slice(0, 2).map((c) => <Tile key={c} label={`${c} wellbeing`} value={e.class_counts[c]} note={`${((e.class_counts[c] / total) * 100).toFixed(0)}% of people`} />)}
      </div>

      <Section title="Wellbeing by group" hint="Pick a way to cut the data. Each bar shows the share of people in the Low, Medium and High wellbeing group; the number under each label is the group size.">
        <div className="mb-3 flex flex-wrap gap-2" role="tablist">
          {SEGMENTS.filter((s) => e[s.key]).map((s) => (
            <button key={s.key} role="tab" aria-selected={seg === s.key} onClick={() => setSeg(s.key)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition ${seg === s.key ? "border-accent bg-soft font-medium text-accent" : "border-line bg-panel text-muted hover:text-ink"}`}>{s.label}</button>
          ))}
        </div>
        <ChartCard title={`Wellbeing mix by ${SEGMENTS.find((s) => s.key === seg).label.toLowerCase()}`}>
          <Chart
            label="Stacked bar chart of wellbeing groups for the chosen segment"
            data={(t) => CLASSES.map((c) => ({
              type: "bar", name: c, x: rows.map((r) => `${r.group}<br><span style="font-size:10px">n=${r.n}</span>`), y: rows.map((r) => r[c.toLowerCase()]),
              marker: { color: classColour(t, c), line: { width: 2, color: t.panel } }, hovertemplate: `${c}: %{y:.0f}%<extra></extra>`,
              text: rows.map((r) => `${r[c.toLowerCase()].toFixed(0)}%`), textposition: "inside", insidetextfont: { color: "#fff" },
            }))}
            layout={() => ({ barmode: "stack", yaxis: { title: { text: "% of people" }, range: [0, 100] } })}
          />
        </ChartCard>
      </Section>

      <Section title="Hours of use and late-night use together" hint="Average wellbeing score by daily hours, split by whether the person uses social media late at night. The gap between the lines shows late-night use matters at every level of use.">
        {e.hours_by_night && (
          <ChartCard title="Mean wellbeing score by hours, with and without late-night use">
            <Chart
              label="Line chart of mean wellbeing score by hours band for late-night users and others"
              data={(t) => Object.entries(e.hours_by_night).map(([k, v], i) => ({
                type: "scatter", mode: "lines+markers", name: k === "Yes" ? "Late-night use" : "No late-night use", x: v.map((p) => p.group), y: v.map((p) => p.mean_score),
                line: { color: k === "Yes" ? t.s2 : t.s1, width: 3 }, marker: { size: 8 }, hovertemplate: "%{y:.2f} (score 0-10)<extra>%{fullData.name}</extra>",
              }))}
              layout={() => ({ yaxis: { title: { text: "Mean wellbeing score" } }, xaxis: { title: { text: "Daily social media use" } } })}
            />
          </ChartCard>
        )}
      </Section>

      <Section title="Which measures move with wellbeing?" hint="Spearman rank correlation with the wellbeing score. Grey bars are mental-state measures (anxiety, sleep quality and so on): they describe wellbeing itself, so they are kept out of the main model.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Correlation with the wellbeing score">
            <Chart
              height={520} label="Horizontal bar chart of Spearman correlation of each measure with the wellbeing score"
              data={(t) => [{
                type: "bar", orientation: "h", y: e.correlations.map((c) => nice(c.feature)), x: e.correlations.map((c) => c.rho),
                marker: { color: e.correlations.map((c) => (c.mediator ? t.muted : c.rho < 0 ? t.s2 : t.s1)) }, hovertemplate: "%{y}: %{x:.2f}<extra></extra>",
              }]}
              layout={() => ({ margin: { l: 170, r: 16, t: 16, b: 40 }, xaxis: { title: { text: "Spearman ρ" }, zeroline: true }, yaxis: { automargin: true } })}
            />
          </ChartCard>
          <div className="grid content-start gap-4">
            <ChartCard title="Distribution of wellbeing scores" note="Dashed lines mark the Low / Medium / High cut-offs.">
              <Chart
                height={240} label="Histogram of mental wellbeing scores"
                data={(t) => [{ type: "bar", x: e.score_hist.counts.map((_, i) => (e.score_hist.edges[i] + e.score_hist.edges[i + 1]) / 2), y: e.score_hist.counts, marker: { color: t.accent }, hovertemplate: "%{y} people<extra></extra>" }]}
                layout={(th) => ({ bargap: 0.05, shapes: [e.cuts.low_below, e.cuts.high_from].map((x) => ({ type: "line", x0: x, x1: x, yref: "paper", y0: 0, y1: 1, line: { color: th.muted, width: 2, dash: "dash" } })), xaxis: { title: { text: "Wellbeing score (0-10)" } }, yaxis: { title: { text: "People" } } })}
              />
            </ChartCard>
            <ChartCard title="Missing values" note="Filled inside each cross-validation fold (median for numbers, 'Unknown' for categories), so no information leaks from the test set.">
              <table className="w-full text-sm">
                <tbody>
                  {e.missing.slice(0, 8).map((m) => (
                    <tr key={m.column} className="border-t border-line first:border-0 [&>td]:py-1.5">
                      <td>{nice(m.column)}</td>
                      <td className="w-40"><div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, m.pct * 10)}%` }} /></div></td>
                      <td className="w-14 text-right tabular-nums text-muted">{m.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {e.missing.length > 8 && <p className="hint mt-1">and {e.missing.length - 8} more columns, all under 5%.</p>}
            </ChartCard>
          </div>
        </div>
      </Section>
    </>
  );
}
