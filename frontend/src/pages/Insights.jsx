import { getInsights } from "../api.js";
import { Chart, CLASSES, classColour } from "../charts.jsx";
import { ChartCard, Loaded, PageHeader, Section, useLoad } from "../components.jsx";

const nice = (s) => s.replace(/_/g, " ");

export default function Insights() {
  const state = useLoad(getInsights);
  return (
    <div>
      <PageHeader title="What drives wellbeing">Using the best model to see which parts of social media use are related to wellbeing, and how the predicted risk changes as use changes.</PageHeader>
      <Loaded state={state}>{(d) => <Body d={d} />}</Loaded>
    </div>
  );
}

function Body({ d }) {
  const imp = d.importance.slice(0, 12).reverse();
  const hours = d.partial_dependence.hours;
  const notif = d.partial_dependence.notifications;
  const night = d.night_effect;
  return (
    <>
      <Section title="Most important factors" hint="Permutation importance: how much the model's macro-F1 falls on unseen people when one input is shuffled. Bigger means the model leans on it more. Inputs with no bar added nothing once the others were known.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartCard title="Importance of each input (drop in macro-F1)">
              <Chart
                height={420} label="Horizontal bar chart of permutation importance"
                data={(t) => [{
                  type: "bar", orientation: "h", y: imp.map((i) => nice(i.feature)), x: imp.map((i) => i.importance),
                  error_x: { type: "data", array: imp.map((i) => i.std), color: t.muted, thickness: 1 },
                  marker: { color: imp.map((i) => (i.feature === "daily_usage_hours" ? t.s2 : t.s1)) }, hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
                }]}
                layout={() => ({ margin: { l: 190, r: 16, t: 16, b: 40 }, xaxis: { title: { text: "Drop in macro-F1 when shuffled" } }, yaxis: { automargin: true } })}
              />
            </ChartCard>
          </div>
          <div className="grid content-start gap-4">
            {d.findings.filter((f) => ["drivers", "age", "platform"].includes(f.id)).map((f) => (
              <div key={f.id} className="card my-0">
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="How predicted risk changes with daily hours" hint="Every test respondent is re-scored as if they used social media for each number of hours, keeping everything else about them the same, and the predictions are averaged. This isolates the pattern for hours alone.">
        <ChartCard title="Average predicted chance of each wellbeing group, by daily hours">
          <Chart
            label="Line chart of average predicted probability of Low, Medium and High wellbeing as daily hours increase"
            data={(t) => CLASSES.map((c) => ({ type: "scatter", mode: "lines", name: c, x: hours.grid, y: hours.prob_pct[c], line: { color: classColour(t, c), width: 3, shape: "spline" }, hovertemplate: `${c}: %{y:.0f}%<extra></extra>` }))}
            layout={() => ({ xaxis: { title: { text: "Daily hours on social media" } }, yaxis: { title: { text: "Predicted chance (%)" }, range: [0, 100] }, hovermode: "x unified" })}
          />
        </ChartCard>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        {night && (
          <ChartCard title="Late-night use" note="Average predicted chance if everyone did, or did not, use social media late at night.">
            <Chart
              label="Grouped bar chart of predicted wellbeing group chances with and without late-night use"
              data={(t) => CLASSES.map((c) => ({ type: "bar", name: c, x: ["Late-night use", "No late-night use"], y: [night.Yes[c], night.No[c]], marker: { color: classColour(t, c) }, text: [night.Yes[c], night.No[c]].map((v) => `${v.toFixed(0)}%`), textposition: "outside", cliponaxis: false }))}
              layout={() => ({ barmode: "group", yaxis: { title: { text: "Predicted chance (%)" }, range: [0, 70] } })}
            />
          </ChartCard>
        )}
        {notif && (
          <ChartCard title="Notifications per day" note="Same method as above, varying daily notifications.">
            <Chart
              label="Line chart of predicted wellbeing group chances as notifications per day increase"
              data={(t) => CLASSES.map((c) => ({ type: "scatter", mode: "lines+markers", name: c, x: notif.grid, y: notif.prob_pct[c], line: { color: classColour(t, c), width: 3 }, hovertemplate: `${c}: %{y:.0f}%<extra></extra>` }))}
              layout={() => ({ xaxis: { title: { text: "Notifications per day" } }, yaxis: { title: { text: "Predicted chance (%)" }, range: [0, 70] } })}
            />
          </ChartCard>
        )}
      </div>
      <p className="hint mt-6 max-w-3xl">{d.findings.find((f) => f.id === "caveat")?.text}</p>
    </>
  );
}
