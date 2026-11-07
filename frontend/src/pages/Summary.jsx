import { Building2, Landmark, Printer } from "lucide-react";
import { getBusinessSummary } from "../api.js";
import { Loaded, PageHeader, useLoad } from "../components.jsx";

export default function Summary() {
  const state = useLoad(getBusinessSummary);
  return (
    <div>
      <PageHeader title="Business & public policy summary" actions={<button className="btn inline-flex items-center gap-2 print:hidden" onClick={() => window.print()}><Printer size={16} /> Print</button>}>
        What the results mean for organisations that advertise on social media, and for the institutions that set the rules.
      </PageHeader>
      <Loaded state={state}>{(s) => (
        <>
          <div className="mb-6 rounded-2xl bg-linear-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70">Bottom line</p>
            <p className="mt-2 max-w-3xl text-lg font-semibold leading-snug tracking-tight">{s.headline}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Column icon={Building2} title="1. Businesses: advertise responsibly" subtitle="Reach the audience without harming their wellbeing" items={s.business} />
            <Column icon={Landmark} title="2. Public institutions: policies and guidelines" subtitle="Protect the wellbeing of the general public" items={s.public} />
          </div>
          <p className="mt-6 rounded-xl border border-line bg-panel p-4 text-sm text-muted shadow-card"><b className="text-ink">Limits. </b>{s.limits}</p>
        </>
      )}</Loaded>
    </div>
  );
}

function Column({ icon: Icon, title, subtitle, items }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-soft text-accent"><Icon size={20} /></span>
        <div><h2 className="font-semibold tracking-tight">{title}</h2><p className="hint">{subtitle}</p></div>
      </div>
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={it.title} className="card my-0 flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-white">{i + 1}</span>
            <div><h3 className="text-sm font-semibold">{it.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted">{it.text}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
