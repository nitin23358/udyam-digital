import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { TrendingUp, AlertTriangle, Target, Radio } from 'lucide-react';
import { PageHead } from './ConsoleLayout.jsx';
import { Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { inr, pct, cx } from '../lib/format.js';

// Validated with the dataviz palette checker (CVD ΔE 25.9, both ≥3:1 on white).
const C_FRICTION = '#E40000';
const C_MARKET = '#3E6CC4';
const C_BAR = '#2E2E36';

const PLAY = {
  micro: ['Self-serve + partners', 'pill-neutral'],
  prof: ['Lead with digital', 'pill-brand'],
  multi: ['Digital quote, field close', 'pill-neutral'],
  mfg: ['Field-led, digital KYC', 'pill-neutral'],
};

export default function Overview() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/analytics').then(setD); }, []);
  if (!d) return <div className="grid place-items-center py-40"><Spinner size={22} className="text-ink-4" /></div>;
  const k = d.kpis;
  const steepest = d.funnel.slice(1).reduce((a, b) => (b.ofPrev < a.ofPrev ? b : a));

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1320px]">
      <PageHead title="Acquisition insights" sub={`smb_leads.csv · ${k.totalLeads.toLocaleString('en-IN')} SMB leads · ${k.period} · synthetic data`} />

      {/* KPI strip */}
      <section className="card grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-line overflow-hidden">
        {[
          ['Leads', k.totalLeads.toLocaleString('en-IN'), 'in the quarter'],
          ['Activated', k.activated.toLocaleString('en-IN'), `${pct(k.conversion)} lead → activation`],
          ['Time to activate', `${k.avgDaysToActivate} days`, 'average, lead → live'],
          ['Cost to acquire', inr(k.cacPerActivation), 'per activated SMB'],
          ['Median bundle', inr(k.medianBundle), 'per month'],
          ['Status chases', `${k.avgChases}×`, 'calls per customer'],
        ].map(([label, value, sub]) => (
          <div key={label} className="p-4 sm:p-5">
            <p className="text-[12px] font-medium text-ink-3">{label}</p>
            <p className="mt-1.5 num text-[24px] sm:text-[26px] font-extrabold tracking-[-0.02em] leading-none">{value}</p>
            <p className="mt-1.5 text-2xs text-ink-4">{sub}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6">
        {/* Funnel */}
        <section className="card card-pad">
          <CardHead title="Where leads drop out" sub={`Steepest step: ${d.funnel[d.funnel.indexOf(steepest) - 1].stage} → ${steepest.stage}`} />
          <ul className="mt-5 space-y-2.5">
            {d.funnel.map((f, i) => {
              const hot = f === steepest;
              return (
                <li key={f.stage} className="group grid grid-cols-[112px_1fr_56px] sm:grid-cols-[132px_1fr_64px] items-center gap-3" title={i ? `${f.lost.toLocaleString('en-IN')} lost at this step` : ''}>
                  <span className={cx('text-[13px] truncate', hot ? 'font-semibold text-ink' : 'text-ink-3')}>{f.stage}</span>
                  <span className="relative h-7 rounded-md bg-line-2">
                    <span className="absolute inset-y-0 left-0 rounded-md transition-all" style={{ width: `${Math.max(f.ofTotal * 100, 1.5)}%`, background: hot ? C_FRICTION : C_BAR }} />
                    <span className="absolute inset-y-0 flex items-center text-[12px] font-semibold num pl-2" style={{ left: `${Math.max(f.ofTotal * 100, 1.5)}%` }}>
                      {f.count.toLocaleString('en-IN')}
                      {i > 0 && <span className="ml-2 font-medium text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity">−{f.lost.toLocaleString('en-IN')}</span>}
                    </span>
                  </span>
                  <span className={cx('text-right num text-[13px]', hot ? 'font-bold text-brand-700' : 'text-ink-3')}>{i ? pct(f.ofPrev, 0) : '—'}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-2xs text-ink-4">Right column: share of the previous stage that moved on. Hover a row for leads lost.</p>
        </section>

        {/* Live digital funnel */}
        <section className="card card-pad flex flex-col">
          <CardHead title="Udyam Digital — live" sub="Journeys recorded by this prototype (SQLite)" icon={<Radio size={15} className="text-brand-600" />} />
          <dl className="mt-4 grid grid-cols-2 gap-px rounded-lg overflow-hidden border border-line bg-line">
            {[
              ['Journeys started', d.digital.journeys],
              ['Reached a price', d.digital.reachedQuote],
              ['KYC verified', d.digital.kycVerified],
              ['Orders placed', d.digital.orders],
            ].map(([l, v]) => (
              <div key={l} className="bg-white p-3.5">
                <dt className="text-2xs text-ink-4">{l}</dt>
                <dd className="num text-[22px] font-extrabold leading-tight mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-2 text-[13px]">
            <Line label="Median time to order" value={d.digital.medianMinutesToOrder != null ? `${d.digital.medianMinutesToOrder} min` : '—'} sub={`vs ${k.avgDaysToActivate} days lead → activation today`} />
            <Line label="Monthly value ordered" value={inr(d.digital.monthlyValue)} />
          </div>
        </section>
      </div>

      {/* Insights */}
      <section className="mt-6">
        <h2 className="text-[15px] font-bold mb-3">What the data says</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {d.insights.map((x) => {
            const tone = { opportunity: [TrendingUp, 'Opportunity', 'text-ok'], risk: [AlertTriangle, 'Risk', 'text-warn'], focus: [Target, 'Focus', 'text-brand-700'] }[x.tone];
            const Icon = tone[0];
            return (
              <article key={x.id} className="card p-5">
                <p className={cx('flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em]', tone[2])}><Icon size={13} />{tone[1]}</p>
                <h3 className="mt-2 text-[14px] font-bold leading-snug text-pretty">{x.title}</h3>
                <p className="mt-1.5 text-[13px] text-ink-3 leading-relaxed text-pretty">{x.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Segments */}
      <section className="mt-6 card overflow-hidden">
        <div className="card-pad pb-4"><CardHead title="Segment economics" sub="Which segments to prioritise, and how to serve each" /></div>
        <div className="overflow-x-auto">
          <table className="c-table w-full text-[13px] min-w-[860px]">
            <thead><tr><th>Segment</th><th>Share of leads</th><th className="text-right">Conversion</th><th className="text-right">CAC / activation</th><th className="text-right">Median bundle</th><th className="text-right">6-mo churn</th><th className="text-right">NPS</th><th>Go-to-market</th></tr></thead>
            <tbody>
              {d.segments.map((s) => (
                <tr key={s.name} className="hover:bg-canvas/60">
                  <td className="font-semibold">{s.name}</td>
                  <td><span className="flex items-center gap-2"><span className="h-1.5 w-24 rounded-full bg-line-2"><span className="block h-full rounded-full bg-ink-2" style={{ width: `${s.share * 100}%` }} /></span><span className="num text-ink-3">{pct(s.share, 0)}</span></span></td>
                  <td className="text-right num font-semibold">{pct(s.conversion)}</td>
                  <td className="text-right num">{inr(s.cacPerActivation)}</td>
                  <td className="text-right num">{inr(s.medianBundle)}</td>
                  <td className={cx('text-right num', s.churn6m > 0.2 && 'text-bad font-semibold')}>{pct(s.churn6m)}</td>
                  <td className="text-right num">{s.nps}</td>
                  <td><span className={cx('pill', PLAY[s.key][1])}>{PLAY[s.key][0]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid xl:grid-cols-2 gap-6">
        {/* Drop reasons */}
        <section className="card card-pad">
          <CardHead title="Why leads were lost" sub={`${pct(d.friction.share, 0)} are process friction a digital journey removes`} />
          <div className="mt-3 flex gap-4 text-2xs text-ink-3">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_FRICTION }} />Our process</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_MARKET }} />Market / customer</span>
          </div>
          <ul className="mt-4 space-y-2">
            {d.drops.slice(0, 12).map((r) => {
              const max = d.drops[0].count;
              const friction = r.kind === 'friction';
              return (
                <li key={r.reason} className="grid grid-cols-[minmax(0,1fr)_44px] sm:grid-cols-[230px_minmax(0,1fr)_44px] items-center gap-x-3 gap-y-1" title={`${r.reason} · lost at "${r.stage}" · ${r.count} leads`}>
                  <span className="text-[12px] text-ink-2 truncate col-span-1">{r.reason}</span>
                  <span className="hidden sm:block h-3.5 rounded-[3px] bg-line-2"><span className="block h-full rounded-[3px]" style={{ width: `${(r.count / max) * 100}%`, background: friction ? C_FRICTION : C_MARKET }} /></span>
                  <span className="text-right num text-[12px] font-semibold">{r.count}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Chases vs churn */}
        <section className="card card-pad">
          <CardHead title="Status chases predict churn" sub="6-month churn by number of times the customer called to chase status" />
          <div className="mt-4 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.chases.map((c) => ({ ...c, label: `${c.calls} call${c.calls > 1 ? 's' : ''}`, churnPct: Math.round(c.churn6m * 1000) / 10 }))} margin={{ top: 22, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="#F1F1F4" />
                <XAxis dataKey="label" type="category" tick={{ fontSize: 12, fill: '#5C5C68' }} axisLine={{ stroke: '#E9E9EE' }} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8B8B96' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(16,16,20,.04)' }} content={<ChaseTip />} />
                <Bar dataKey="churnPct" fill={C_BAR} radius={[4, 4, 0, 0]} maxBarSize={46}>
                  <LabelList dataKey="churnPct" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: '#2E2E36', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-2xs text-ink-4">Activated customers only (n = {k.activated}). The order tracker targets this directly.</p>
        </section>
      </div>

      <div className="mt-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6">
        {/* Sources */}
        <section className="card overflow-hidden">
          <div className="card-pad pb-4"><CardHead title="Lead sources" sub="Conversion vs cost — where the field force adds most value" /></div>
          <div className="overflow-x-auto">
            <table className="c-table w-full text-[13px] min-w-[560px]">
              <thead><tr><th>Source</th><th className="text-right">Leads</th><th>Conversion</th><th className="text-right">CAC / activation</th><th className="text-right">Churn</th></tr></thead>
              <tbody>
                {d.sources.map((s) => (
                  <tr key={s.name} className="hover:bg-canvas/60">
                    <td className="font-medium">{s.name}</td>
                    <td className="text-right num text-ink-3">{s.leads.toLocaleString('en-IN')}</td>
                    <td><span className="flex items-center gap-2"><span className="h-1.5 w-20 rounded-full bg-line-2"><span className="block h-full rounded-full bg-ink-2" style={{ width: `${(s.conversion / 0.16) * 100}%` }} /></span><span className="num font-semibold">{pct(s.conversion)}</span></span></td>
                    <td className="text-right num">{inr(s.cacPerActivation)}</td>
                    <td className="text-right num text-ink-3">{pct(s.churn6m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Targets */}
        <section className="card overflow-hidden">
          <div className="card-pad pb-4"><CardHead title="Success metrics & targets" sub="Baseline from the data → 12-month target" /></div>
          <ul className="divide-y divide-line-2 border-t border-line">
            {d.targets.map((x) => (
              <li key={x.metric} className="px-5 sm:px-6 py-3 grid grid-cols-[1fr_auto] gap-x-4">
                <span className="text-[13px] font-semibold">{x.metric}</span>
                <span className="num text-[13px] text-right whitespace-nowrap"><span className="text-ink-4 line-through decoration-ink-4/50">{x.baseline}</span> <span className="mx-1 text-ink-4">→</span> <b className="text-ink">{x.target}</b></span>
                <span className="text-2xs text-ink-4 col-span-2">{x.why}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CardHead({ title, sub, icon }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[15px] font-bold">{icon}{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
    </div>
  );
}
function Line({ label, value, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-3">{label}{sub && <span className="block text-2xs text-ink-4">{sub}</span>}</span>
      <span className="num font-bold">{value}</span>
    </div>
  );
}
function ChaseTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white shadow-lift px-3 py-2 text-[12px]">
      <p className="font-semibold">{p.calls} status call{p.calls > 1 ? 's' : ''}</p>
      <p className="text-ink-3 num">{p.customers} customers · churn {p.churnPct}% · NPS {p.nps}</p>
    </div>
  );
}
