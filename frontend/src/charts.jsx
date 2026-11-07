import { useEffect, useState } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-cartesian-dist-min";

const Plot = createPlotlyComponent(Plotly);
const TOKENS = { text: "--text", muted: "--muted", grid: "--line", panel: "--panel", s1: "--s1", s2: "--s2", s3: "--s3", s4: "--s4", s5: "--s5", s6: "--s6", accent: "--accent" };

// Plotly needs real colour strings, so read the CSS tokens and re-read them when the OS theme changes.
function readTheme() {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, css.getPropertyValue(v).trim()]));
}
export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(readTheme());
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return theme;
}

// A wellbeing group keeps its colour on every chart (orange / gold / blue stay distinguishable for colour-blind readers).
export const CLASSES = ["Low", "Medium", "High"];
export const CLASS_COLOUR = { Low: "s2", Medium: "s4", High: "s1" };
export const classColour = (t, c) => t[CLASS_COLOUR[c]];

export function Chart({ data, layout = () => ({}), height = 320, label }) {
  const t = useTheme();
  const axis = { gridcolor: t.grid, linecolor: t.grid, zerolinecolor: t.grid, tickfont: { color: t.muted }, title: { font: { color: t.muted } }, fixedrange: true };
  const l = layout(t);
  return (
    <div role="img" aria-label={label}>
      <Plot
        data={data(t)}
        layout={{
          height, autosize: true, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
          font: { family: '"Inter Variable", system-ui, sans-serif', size: 12, color: t.text },
          margin: { l: 56, r: 16, t: 24, b: 48 },
          legend: { orientation: "h", y: -0.3, font: { color: t.muted } },
          hoverlabel: { bgcolor: t.panel, bordercolor: t.grid, font: { color: t.text } },
          ...l,
          xaxis: { ...axis, ...l.xaxis },
          yaxis: { ...axis, ...l.yaxis },
        }}
        config={{ displaylogo: false, responsive: true, displayModeBar: "hover", modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"] }}
        style={{ width: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
