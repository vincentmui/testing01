import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, BookOpenCheck, Code2, NotebookText, Compass, Lightbulb, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Scale, Sparkles, X } from "lucide-react";
import { getBranding, health } from "./api.js";
import { Logo } from "./components.jsx";

// Plotly is large, so every chart page loads only when it opens
const Overview = lazy(() => import("./pages/Overview.jsx"));
const Explore = lazy(() => import("./pages/Explore.jsx"));
const Models = lazy(() => import("./pages/Models.jsx"));
const Insights = lazy(() => import("./pages/Insights.jsx"));
const Predict = lazy(() => import("./pages/Predict.jsx"));
const Summary = lazy(() => import("./pages/Summary.jsx"));
const Method = lazy(() => import("./pages/Method.jsx"));
const Notebooks = lazy(() => import("./pages/Notebooks.jsx"));
const Guide = lazy(() => import("./pages/Guide.jsx"));
const ApiDocs = lazy(() => import("./pages/ApiDocs.jsx"));

const GROUPS = [
  { label: "Dashboard", pages: [{ to: "/", label: "Overview", icon: LayoutDashboard }, { to: "/explore", label: "Explore data", icon: Compass }] },
  { label: "Analysis", pages: [{ to: "/models", label: "Models", icon: BarChart3 }, { to: "/insights", label: "What drives wellbeing", icon: Lightbulb }, { to: "/method", label: "CRISP-DM method", icon: BookOpenCheck }, { to: "/notebooks", label: "Notebooks", icon: NotebookText }] },
  { label: "Use it", pages: [{ to: "/predict", label: "Predict", icon: Sparkles }, { to: "/summary", label: "Business & policy", icon: Scale }] },
  { label: "Help", pages: [{ to: "/guide", label: "User guide", icon: BookOpen }] },
  { label: "Developers", pages: [{ to: "/api-docs", label: "API docs", icon: Code2 }] },
];
const PAGES = GROUPS.flatMap((g) => g.pages);

// the sidebar's collapsed state is a per-browser convenience; the app works without storage
const remembered = () => { try { return localStorage.getItem("sidebar") === "collapsed"; } catch { return false; } };
const remember = (collapsed) => { try { localStorage.setItem("sidebar", collapsed ? "collapsed" : "open"); } catch { /* storage unavailable */ } };

export default function App() {
  const [loaded, setLoaded] = useState(null); // null until /api/branding answers, so no placeholder name flashes
  const branding = loaded ?? { name: "", tagline: "", logo_url: "" };
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(remembered);
  const [online, setOnline] = useState(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    getBranding().then((b) => { setLoaded(b); document.title = b.name; }).catch(() => setLoaded({ name: "Wellbeing Lab", tagline: "", logo_url: "" }));
  }, []);
  useEffect(() => {
    const check = () => health().then(() => setOnline(true)).catch(() => setOnline(false));
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  const toggleCollapsed = () => { remember(!collapsed); setCollapsed(!collapsed); };
  const title = PAGES.find((p) => p.to === pathname)?.label ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-30 print:hidden">
        <div className="h-[3px] bg-linear-to-r from-indigo-600 via-violet-600 to-indigo-600" />
        <header className="flex h-[60px] items-center gap-4 border-b border-line bg-panel/90 px-4 backdrop-blur md:px-6">
          <button className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-accent md:hidden" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className={`flex items-center gap-3 transition-opacity ${loaded ? "" : "opacity-0"}`}>
            <Logo branding={branding} size="size-9" />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight">{branding.name}</span>
              {branding.tagline && <span className="block text-xs text-muted">{branding.tagline}</span>}
            </span>
          </span>
          <span className="hidden items-center gap-2 text-sm text-muted md:flex"><span className="text-line">/</span>{title}</span>
          <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-xs text-muted" title="API status">
            <i className={`size-2 rounded-full ${online === null ? "bg-muted" : online ? "bg-ok shadow-[0_0_0_3px_rgb(34_197_94/.2)]" : "bg-bad"}`} />
            <span className="hidden sm:inline">{online === null ? "Checking" : online ? "API online" : "API offline"}</span>
          </span>
        </header>
      </div>

      <div className="flex flex-1">
        {open && <div className="fixed inset-0 top-[63px] z-20 bg-slate-900/40 backdrop-blur-[1px] md:hidden" onClick={() => setOpen(false)} />}
        <nav
          aria-label="Main"
          className={`print:hidden fixed bottom-0 left-0 top-[63px] z-30 flex w-60 flex-col border-r border-line bg-panel px-3 py-4 transition-all md:sticky md:h-[calc(100vh-63px)] md:translate-x-0 md:self-start ${collapsed ? "md:w-[72px]" : "md:w-60"} ${open ? "" : "-translate-x-full"}`}
        >
          <div className="flex-1 space-y-5 overflow-y-auto">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className={`mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${collapsed ? "md:invisible md:h-0 md:mb-3" : ""}`}>{g.label}</p>
                <div className="space-y-0.5">
                  {g.pages.map((p) => (
                    <NavLink
                      key={p.to} to={p.to} end={p.to === "/"} title={collapsed ? p.label : undefined}
                      className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${collapsed ? "md:justify-center" : ""} ${isActive ? "bg-soft font-medium text-accent" : "text-muted hover:bg-bg hover:text-ink"}`}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute -left-3 top-2 h-5 w-[3px] rounded-r bg-linear-to-b from-indigo-600 to-violet-600" />}
                          <p.icon size={18} strokeWidth={1.8} />
                          <span className={collapsed ? "md:hidden" : ""}>{p.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={toggleCollapsed}
            className={`mt-3 hidden items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-bg hover:text-ink md:flex ${collapsed ? "justify-center" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : undefined}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} /> : <PanelLeftClose size={18} strokeWidth={1.8} />}
            <span className={collapsed ? "hidden" : ""}>Collapse</span>
          </button>
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={<p className="hint">Loading…</p>}>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/models" element={<Models />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/method" element={<Method />} />
                <Route path="/predict" element={<Predict />} />
                <Route path="/summary" element={<Summary />} />
                <Route path="/notebooks" element={<Notebooks />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/api-docs" element={<ApiDocs />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>

      <footer className="print:hidden flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line bg-panel px-4 py-3.5 text-xs text-muted md:px-8">
        <span>UC Berkeley ML/AI Capstone · Social media usage and mental wellbeing</span>
        <span>Author: Vincent Mui · © {new Date().getFullYear()} {branding.name}</span>
      </footer>
    </div>
  );
}
