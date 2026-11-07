import { ArrowUpRight } from "lucide-react";
import { Note, PageHeader } from "../components.jsx";

// HTML copies of notebooks/*.ipynb, produced by scripts/notebooks-html.sh into public/notebooks.
const NOTEBOOKS = [
  ["01_data_understanding_and_cleaning", "1. Data understanding and cleaning", "The business question, what the survey contains, missing values, cleaning, the Low / Medium / High groups and which columns are kept out of the model."],
  ["02_exploratory_analysis", "2. Exploratory analysis", "Charts and statistical tests: hours of use, late-night use and other habits, platform, age and correlations with wellbeing."],
  ["03_modeling", "3. Modeling", "Six models tuned with grid search and cross-validation, why macro-F1 is the metric, the best model's errors and what drives its predictions."],
  ["04_findings_and_recommendations", "4. Findings and recommendations", "The results in plain language, with recommendations for platforms, advertisers and policy makers, and next steps."],
];

export default function Notebooks() {
  return (
    <div>
      <PageHeader title="Notebooks">The step-by-step analysis behind this dashboard. Read them in order; each one opens in a new tab.</PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {NOTEBOOKS.map(([file, title, text]) => (
          <a key={file} href={`/notebooks/${file}.html`} target="_blank" rel="noreferrer" className="group block rounded-xl border border-line bg-panel p-5 shadow-card transition hover:border-accent">
            <span className="flex items-center justify-between text-base font-semibold tracking-tight">
              {title}
              <ArrowUpRight size={16} className="text-muted group-hover:text-accent" />
            </span>
            <span className="mt-2 block text-sm leading-relaxed text-muted">{text}</span>
          </a>
        ))}
      </div>
      <Note>To run or edit them, open the <code>notebooks/</code> folder in Jupyter or VS Code (see the README). The pages above are read-only copies.</Note>
    </div>
  );
}
