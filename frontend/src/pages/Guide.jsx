import { Link } from "react-router-dom";
import { ArrowUpRight, Download, FileText } from "lucide-react";
import { CodeBlock, Note, PageHeader } from "../components.jsx";

// Screenshots live in public/docs and are regenerated with scripts/screenshots.sh.
const IMG = "/docs";

const TOC = [
  ["start", "Quick start"],
  ["tour", "Tour of the pages"],
  ["notebooks", "The notebooks"],
  ["predict", "Making predictions"],
  ["retrain", "Re-running the analysis"],
  ["api", "Using the API"],
  ["settings", "Settings"],
  ["numbers", "Reading the numbers"],
  ["help", "Troubleshooting"],
];

// `pos` picks which part of a tall screenshot to show (CSS object-position); clicking opens the full image.
function Figure({ name, alt, caption, pos = "top", height = "h-72 sm:h-96" }) {
  return (
    <figure className="my-4 break-inside-avoid">
      <a href={`${IMG}/${name}.png`} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-line bg-panel shadow-card" title="Open the full screenshot">
        <img src={`${IMG}/${name}.png`} alt={alt} className={`${height} w-full object-cover print:h-72!`} style={{ objectPosition: pos }} />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">Full size <ArrowUpRight size={12} /></span>
      </a>
      <figcaption className="hint mt-1.5">{caption}</figcaption>
    </figure>
  );
}

const Steps = ({ children }) => (
  <ol className="my-3 space-y-2.5">
    {children.map((c, i) => (
      <li key={i} className="flex gap-3 text-sm leading-relaxed">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-semibold text-accent">{i + 1}</span>
        <span>{c}</span>
      </li>
    ))}
  </ol>
);

const Code = ({ children }) => <code className="rounded bg-bg px-1 py-0.5 text-[.85em]">{children}</code>;
const Bullets = ({ items }) => <ul className="my-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-accent">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
const H2 = ({ id, children }) => <h2 id={id} className="mb-3 mt-12 scroll-mt-24 border-b border-line pb-2 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>;
const H3 = ({ id, to, children }) => (
  <h3 id={id} className="mb-1 mt-9 flex scroll-mt-24 items-center gap-3 text-base font-semibold tracking-tight">
    {children}
    {to && <Link to={to} className="ml-auto inline-flex items-center gap-1 text-sm font-normal text-accent hover:underline">Open page <ArrowUpRight size={14} /></Link>}
  </h3>
);
const P = ({ children }) => <p className="my-2 text-sm leading-relaxed">{children}</p>;

function Table({ head, rows }) {
  return (
    <div className="my-3 overflow-x-auto break-inside-avoid rounded-xl border border-line bg-panel">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-muted">{head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0 align-top">{r.map((c, j) => <td key={j} className={`px-4 py-2.5 ${j === 0 ? "whitespace-nowrap font-medium" : "text-muted"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const ORIGIN = location.origin;
const PREDICT_CURL = `curl -X POST ${ORIGIN}/api/predict \\
  -H "Content-Type: application/json" \\
  -d '{"inputs": {"daily_usage_hours": 6.5, "late_night_usage": "Yes",
                  "first_check_morning": "Within 5 min", "failed_to_cut_back": "Yes",
                  "fomo_score": 7}}'`;
const PREDICT_REPLY = `{
  "prediction": "Low",
  "probabilities": { "Low": 0.9377, "Medium": 0.0617, "High": 0.0007 },
  "what_if": [
    { "scenario": "One hour less per day", "prediction": "Low", "probabilities": { "Low": 0.9207, "Medium": 0.0781, "High": 0.0011 } },
    { "scenario": "No late-night use",     "prediction": "Low", "probabilities": { "Low": 0.72, "Medium": 0.2703, "High": 0.0097 } }
  ]
}`;
const BATCH_CURL = `curl -X POST ${ORIGIN}/api/predict/batch -F "file=@people.csv"`;
const TRAIN_CURL = `curl -X POST ${ORIGIN}/api/train          # -> {"job_id": "3f2c9a1e", "status": "running"}
curl ${ORIGIN}/api/jobs/3f2c9a1e         # poll until "status" is "done" or "failed"`;

export default function Guide() {
  return (
    <div>
      <PageHeader title="User guide" actions={<a href="/docs/user-guide.pdf" download className="btn inline-flex items-center gap-2 print:hidden"><FileText size={16} /> Download PDF</a>}>How to run Wellbeing Lab, what every page shows, and how to get predictions out of it, with screenshots of the real app.</PageHeader>
      <p className="hidden text-sm text-muted print:block">Wellbeing Lab · Author: Vincent Mui</p>
      <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">On this page</p>
            <ul className="space-y-1 border-l border-line text-sm">
              {TOC.map(([id, label]) => <li key={id}><a href={`#${id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-muted hover:border-accent hover:text-accent">{label}</a></li>)}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <H2 id="start">Quick start</H2>
          <P>Wellbeing Lab asks one question: <b>is the time people spend on social media related to their mental wellbeing?</b> It cleans a survey of 1,500 people, compares six classification models, and shows the answer as a dashboard you can also query as an API.</P>
          <Steps>{[
            <>From the project folder run <Code>./start.sh</Code>. The first run trains the models (about a minute) and installs the front end.</>,
            <>Open <Code>{ORIGIN}</Code> in a browser. The green <b>API online</b> badge at the top right means the page can reach the server.</>,
            <>Start on <Link to="/" className="linkbtn !px-0">Overview</Link> for the headline result, read the step-by-step analysis on <Link to="/notebooks" className="linkbtn !px-0">Notebooks</Link>, then try <Link to="/predict" className="linkbtn !px-0">Predict</Link>.</>,
            <>When you are done run <Code>./stop.sh</Code> (or press Ctrl-C in the terminal that runs <Code>start.sh</Code>).</>,
          ]}</Steps>
          <Note>The sidebar groups the pages by purpose. The <b>Collapse</b> button at its bottom shrinks it to icons, and the browser remembers your choice. On a phone the menu button at the top left opens it.</Note>

          <H2 id="tour">Tour of the pages</H2>
          <P>The pages follow the CRISP-DM order: understand the data, build models, interpret them, then use them. Click any screenshot to see it full size.</P>

          <H3 to="/">Overview</H3>
          <Figure name="overview" alt="The Overview page with headline numbers and a chart of wellbeing by daily hours" caption="Overview: the answer in one screen." />
          <Bullets items={[
            "The tiles give the number of respondents, how strongly hours of use and wellbeing move together (Spearman ρ), the best model, and its accuracy on people it never saw.",
            "The chart shows how the share of Low, Medium and High wellbeing changes as daily hours rise. The small chart beside it shows how many people each bar is based on, so you can tell a firm result from a thin one.",
            "Key findings are written from the measured numbers each time the analysis runs, so they always match the charts.",
            "Re-run analysis (top right) retrains everything. See Re-running the analysis below.",
          ]} />

          <H3 to="/explore">Explore data</H3>
          <Figure name="explore" alt="The Explore data page with data quality tiles and wellbeing by group" caption="Explore data: what is in the survey before any model is fitted." />
          <Bullets items={[
            "The top tiles show the rows and columns left after cleaning and the size of the Low and Medium groups. Data-quality detail (blank cells per column) is at the bottom.",
            "Wellbeing by group: choose how to cut the data (hours of use, age, late-night use, platform, gender, occupation, relationship status). Each bar shows the share of Low, Medium and High, and the number under each label is how many people are in that group.",
            "The hours-and-late-night chart compares average wellbeing with and without late-night use. The gap between the lines is the late-night effect.",
            "The correlation chart ranks measures by how closely they move with the wellbeing score. Grey bars are the mental-state measures such as anxiety and sleep quality. They are outcomes rather than habits, so the models do not use them as inputs.",
          ]} />

          <H3 to="/models">Models</H3>
          <Figure name="models" alt="The Models page with the best model card, comparison table and bar chart" caption="Models: six classifiers tuned by grid search and compared on people they never saw." />
          <Bullets items={[
            "The highlighted card names the best model and its best hyper-parameters. It is chosen on cross-validated macro-F1 from the training data only, so the test set plays no part in the choice.",
            "The table lists every model with its tuned hyper-parameters, cross-validated score and test metrics. The always-guess-the-biggest-group baseline is the bar to beat.",
            "The bar chart sets cross-validated against test macro-F1. Two bars close together mean the model generalises. A big gap (the decision tree and forest here) means it overfits.",
            "Decision-threshold tuning shows the per-class weights that were searched, the before and after scores, and whether they were adopted. Use the Standard rule / Tuned weights switch to see the confusion matrix and per-group results for each.",
          ]} />

          <H3 to="/insights">What drives wellbeing</H3>
          <Figure name="insights" alt="The What drives wellbeing page with the importance chart and findings" caption="What drives wellbeing: which habits the best model leans on, and how predicted risk moves." />
          <Bullets items={[
            "Importance shows how much the model's score drops when one input is shuffled. A long bar means the model relies on that input.",
            "The risk curves re-score every test person as if they used social media for 1, 2, 3 … hours, keeping everything else about them fixed. The same is done for late-night use and for notifications.",
            "These are associations in one survey. They do not prove that social media causes lower wellbeing.",
          ]} />

          <H3 to="/method">CRISP-DM method</H3>
          <Figure name="method" alt="The CRISP-DM method page with six numbered stages" caption="CRISP-DM method: the six stages, with the numbers from this run." />
          <P>Business understanding, data understanding, preparation, modelling, evaluation and deployment, each with what was done and what it found. Use it as the written method for a report.</P>

          <H3 to="/notebooks">Notebooks</H3>
          <Figure name="notebooks" alt="The Notebooks page with four cards, one per notebook" caption="Notebooks: the four analysis notebooks, readable in the browser." height="h-64 sm:h-80" />
          <Bullets items={[
            "Four cards, in reading order: data understanding and cleaning, exploratory analysis, modeling, and findings and recommendations. Each opens a read-only HTML copy in a new tab, with all charts and results included.",
            "The notebooks are the technical write-up of the study. They use the same code as the app, so their numbers match the dashboard.",
          ]} />

          <H3 to="/summary">Business &amp; policy</H3>
          <Figure name="summary" alt="The Business and public policy summary page" caption="Business & policy: recommendations that rest on the measured results." />
          <Bullets items={[
            "Two sections: how businesses can advertise responsibly with audience wellbeing in mind, and how public institutions can set policy and guidelines.",
            "Each recommendation quotes the figure it is based on. A short limits section says what the data cannot show.",
            "Print (top right) opens the browser's print dialog, so you can print the page or save it as a PDF.",
          ]} />

          <H3 to="/api-docs">API docs</H3>
          <Figure name="api" alt="The API docs page listing the endpoints" caption="API docs: every endpoint with its parameters, a ready-to-copy curl command and an example response." />
          <P>The page is built from the server's own description, so it cannot fall out of date. The interactive Swagger version is at <a className="linkbtn !px-0" href="/api/docs">/api/docs</a>.</P>

          <H2 id="notebooks">The notebooks</H2>
          <P>The analysis is also delivered as four Jupyter notebooks in the <Code>notebooks/</Code> folder. Read them in order:</P>
          <Table head={["Notebook", "What it covers"]} rows={[
            ["01 Data understanding and cleaning", "The business question, the survey columns, missing values, cleaning, the Low / Medium / High groups and which columns are excluded to avoid leakage."],
            ["02 Exploratory analysis", "Charts and statistical tests (Spearman correlation, chi-square) for hours of use, habits, platform, age and the wellbeing score."],
            ["03 Modeling", "Six models tuned by grid search and cross-validation, the macro-F1 metric and why it was chosen, the confusion matrix, permutation importance and the threshold-tuning check."],
            ["04 Findings and recommendations", "Plain-language findings, recommendations for platforms, advertisers and policy makers, and next steps."],
          ]} />
          <Steps>{[
            <>To read them without installing anything, open <Link to="/notebooks" className="linkbtn !px-0">Notebooks</Link> in the app.</>,
            <>To run or edit them, run <Code>uv sync</Code> once, then <Code>uv run jupyter lab notebooks/</Code> (or open the folder in VS Code). Run each notebook from top to bottom; the full set takes under a minute.</>,
            <>After changing a notebook, run <Code>scripts/notebooks-html.sh</Code> to refresh the copies shown in the app.</>,
          ]}</Steps>

          <H2 id="predict">Making predictions</H2>
          <H3>One person at a time</H3>
          <Figure name="predict-heavy" alt="The Predict page showing a Low prediction for heavy late-night use" caption="Predict, started from the Heavy late-night use preset. The sliders are on the left, the result and what-if scenarios on the right." height="h-80 sm:h-[26rem]" />
          <Steps>{[
            <>Open <Link to="/predict" className="linkbtn !px-0">Predict</Link>. The form starts from a typical respondent (the most common answer or the median for each field).</>,
            <>Optionally pick a preset under <b>Start from</b>: <i>Light daytime use</i> or <i>Heavy late-night use</i>. <b>Typical</b> resets everything.</>,
            <>Move the sliders and choose from the lists. The result on the right updates about 0.2 seconds after you stop, so there is no submit button.</>,
            <>Read the <b>Expected wellbeing group</b> and the three probability bars. They add up to 100%.</>,
            <>Check <b>What if…</b>: it re-scores the same person with one hour less per day, and with no late-night use (shown only when it applies). The figure is the chance of Low wellbeing and the change in percentage points. Green means the change helps.</>,
          ]}</Steps>
          <Bullets items={[
            <>Leave a list on <i>Not specified</i> if you do not know the answer. The model fills the gap the same way it did in training.</>,
            "The result is a statistical pattern in a survey. It is not a diagnosis of any person.",
            <>A link such as <Code>/predict?preset=Heavy late-night use</Code> opens the page with that preset already applied.</>,
          ]} />

          <H3>A whole file at once</H3>
          <Figure name="predict" alt="The Score a file upload area at the bottom of the Predict page" caption="Score a file: drop a CSV on the dashed area, or click it to choose one." pos="50% 76%" height="h-44 sm:h-52" />
          <Steps>{[
            <>Prepare a CSV with a header row. Column names should match the survey's (for example <Code>Daily_Usage_Hours</Code>, <Code>Late_Night_Usage</Code>). Capitalisation, spaces versus underscores, and column order do not matter.</>,
            <>Drop the file on <b>Score a file</b> at the bottom of the Predict page, or click the area to choose it.</>,
            <>The page shows how many people were scored and how many fell in each group. <b>Download results</b> saves <Code>predictions.csv</Code> with the row number, predicted group and the three probabilities.</>,
          ]}</Steps>
          <a href={`${IMG}/sample_people.csv`} download className="btn mb-2 inline-flex items-center gap-2 !py-1.5 text-sm"><Download size={15} /> Download a 25-row sample CSV</a>
          <Table head={["Rule", "Detail"]} rows={[
            ["Size", "Up to 5,000 rows per file."],
            ["Columns", "Any survey column can be used. Extra columns such as User_ID, Mental_Wellbeing_Score and Addiction_Level are ignored, and missing columns are treated as blank."],
            ["Blank cells", "Allowed. They are filled the same way as in training."],
            ["No match", "If none of your column names is recognised the upload is rejected with the list of expected names."],
          ]} />

          <H2 id="retrain">Re-running the analysis</H2>
          <P>Run the analysis again after replacing the data file, changing a setting, or if you simply want to see it work. It cleans the data, tunes all six models, picks the best, tunes the threshold, and rewrites the report and model. Every page, including the written findings, then updates.</P>
          <Steps>{[
            <>Click <b>Re-run analysis</b> at the top right of Overview or Models. On a fresh install with no results, the same button appears as <b>Run the analysis</b> in the middle of the page.</>,
            <>Watch the progress bar and step name. It takes under a minute.</>,
            <>The pages refresh with the new numbers when it finishes. If it fails, the message appears under the button.</>,
          ]}</Steps>
          <P>Only one run can be active at a time. A second request gets a "run already in progress" answer. From a terminal use:</P>
          <CodeBlock text={`uv run python -m wellbeing.train            # full run\nuv run python -m wellbeing.train --quick    # small grids, for a fast check`} />

          <H2 id="api">Using the API</H2>
          <P>The UI is a client of the same API, so everything on screen can be scripted. Interactive docs are at <a className="linkbtn !px-0" href="/api/docs">/api/docs</a>, and the machine-readable description is at <a className="linkbtn !px-0" href="/api/openapi.json">/api/openapi.json</a>.</P>
          <h3 className="mb-1 mt-5 text-sm font-semibold">Predict one person</h3>
          <P>Send only the fields you know, using the names listed by <Code>GET /api/predict/options</Code>. Unknown names, unknown category values and non-numbers are rejected with a 422 that says what is allowed.</P>
          <CodeBlock text={PREDICT_CURL} />
          <CodeBlock text={PREDICT_REPLY} />
          <h3 className="mb-1 mt-5 text-sm font-semibold">Predict a file</h3>
          <CodeBlock text={BATCH_CURL} />
          <P>The reply has <Code>rows</Code>, <Code>counts</Code> per group, and <Code>results</Code> with a prediction and probabilities for each row in the file's order. Errors: 400 if the file is not a CSV, 413 above 5,000 rows, 422 if no column is recognised.</P>
          <h3 className="mb-1 mt-5 text-sm font-semibold">Re-train</h3>
          <CodeBlock text={TRAIN_CURL} />
          <Table head={["Endpoint", "Returns"]} rows={[
            ["GET /api/health", "Liveness check used by the API online badge."],
            ["GET /api/report", "The whole report in one document."],
            ["GET /api/models, /threshold, /insights", "Model comparison, threshold tuning, importance and risk curves."],
            ["GET /api/eda, /data/summary", "Exploratory statistics and data-quality numbers."],
            ["GET /api/business-summary", "Recommendations with the numbers they rest on."],
            ["Before the first run", "Result endpoints answer 404 with a hint to run the analysis."],
          ]} />

          <H2 id="settings">Settings</H2>
          <P>Everything works with no configuration. To change something copy <Code>.env.example</Code> to <Code>.env</Code> and uncomment the line. Restart after editing, then re-run the analysis if the setting affects the model.</P>
          <Table head={["Setting", "Default", "Meaning"]} rows={[
            ["DATA_FILE", "data/social_media_addiction_mental_wellbeing.csv", "The survey CSV to analyse."],
            ["ARTIFACTS_DIR", "artifacts", "Where the trained model and report are saved."],
            ["APP_NAME", "Wellbeing Lab", "Name shown in the header and page title."],
            ["TEST_SIZE", "0.25", "Share of people held out to score the final model."],
            ["CV_FOLDS", "5", "Folds used by the grid searches."],
            ["N_FEATURES", "20", "How many of the most informative columns each model keeps."],
            ["API_PORT / UI_PORT", "8010 / 5180", "Ports used by start.sh and stop.sh (set them in the shell, for example UI_PORT=5200 ./start.sh)."],
          ]} />

          <H2 id="numbers">Reading the numbers</H2>
          <Table head={["Term", "What it means here"]} rows={[
            ["Low / Medium / High", "The wellbeing score split into thirds: the lowest third is Low, the highest third High. The median score sits inside Medium."],
            ["Macro-F1", "The F1 score of Low, Medium and High averaged equally, so a model cannot score well by ignoring one group. 1 is perfect. Always guessing the biggest group scores about 0.18."],
            ["Accuracy", "The share of people placed in the right group."],
            ["ROC AUC", "How well the predicted probabilities rank people, from 0.5 (chance) to 1 (perfect)."],
            ["Cross-validated (CV)", "Scores from splitting the training data five ways, training on four parts and testing on the fifth. It is used to choose between models."],
            ["Test", "Scores on the held-out people, used once at the end. This is the honest estimate."],
            ["Hyper-parameter", "A model setting chosen before training, such as C for logistic regression. Grid search tries many and keeps the best."],
            ["Decision threshold", "With three groups, a weight on each group's probability before the largest is picked. Tuned weights are adopted only if they help."],
            ["Permutation importance", "How far macro-F1 falls when one input is shuffled. A bigger fall means a more important input."],
            ["Association", "Two things moving together. It does not show that one causes the other."],
          ]} />

          <H2 id="help">Troubleshooting</H2>
          <Table head={["Symptom", "What to do"]} rows={[
            ["Badge says API offline", "The server is not running or not reachable. Run ./start.sh, and check the terminal for errors."],
            ["Pages show “No results yet”", "No analysis has run. Click Run the analysis, or run uv run python -m wellbeing.train."],
            ["A port is already in use", "Another program has 8010 or 5180. Start with different ones: API_PORT=8020 UI_PORT=5200 ./start.sh."],
            ["Re-run says a run is in progress", "Wait for the current one to finish (under a minute) and try again."],
            ["Upload rejected with 422", "None of the column names was recognised. Compare your header with the sample CSV."],
            ["Upload rejected with 413", "The file has more than 5,000 rows. Split it."],
            ["Prediction field refused", "The message lists the allowed values. Category names must match exactly, for example “Within 5 min”."],
            ["Stop everything", "Run ./stop.sh. It only stops this project's own processes."],
          ]} />
        </article>
      </div>
    </div>
  );
}
