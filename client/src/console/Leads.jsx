import { useEffect, useMemo, useState } from 'react';
import { Search, X, Sparkles, ChevronLeft, ChevronRight, Copy, Check, MessageCircle, Route, Gauge, Zap } from 'lucide-react';
import { PageHead } from './ConsoleLayout.jsx';
import { Spinner, Segmented, Empty } from '../components/ui.jsx';
import { useApp } from '../lib/app.jsx';
import { api } from '../lib/api.js';
import { inr, cx, fmtDate } from '../lib/format.js';

const SEGMENTS = [['', 'All segments'], ['micro', 'Micro retail'], ['prof', 'Professional'], ['multi', 'Multi-site'], ['mfg', 'Manufacturers']];
const ROUTES = ['', 'Digital nudge', 'Inside sales', 'Channel partner', 'Field sales'];
const FU_TONE = { New: 'pill-neutral', Contacted: 'pill-neutral', 'Call back': 'pill-warn', 'Won back': 'pill-ok', 'Not interested': 'pill-neutral opacity-60' };

export default function Leads() {
  const { meta } = useApp();
  const [f, setF] = useState({ q: '', source: '', segment: '', priority: '', route: '', followup: '', page: 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, page: k === 'page' ? v : 1 }));

  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString(), [f]);
  const load = () => { setLoading(true); api.get(`/leads?${qs}&pageSize=20`).then(setData).finally(() => setLoading(false)); };
  useEffect(() => { const h = setTimeout(load, f.q ? 250 : 0); return () => clearTimeout(h); }, [qs]); // eslint-disable-line

  const s = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1320px]">
      <PageHead title="Follow-up worklist" sub="Dropped leads ranked by how likely they are to come back, plus digital journeys the advisor could not close." />

      {s && (
        <section className="card grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-line overflow-hidden mb-5">
          {[
            ['In view', s.total.toLocaleString('en-IN')],
            ['High priority', s.high.toLocaleString('en-IN')],
            ['Lost to our process', s.friction.toLocaleString('en-IN')],
            ['From digital advisor', s.digital],
            ['Won back', s.wonBack],
          ].map(([l, v]) => (
            <div key={l} className="px-4 py-3.5"><p className="text-2xs text-ink-4">{l}</p><p className="num text-[20px] font-extrabold mt-0.5">{v}</p></div>
          ))}
        </section>
      )}

      {/* Filters — one row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input className="field h-9 pl-9 text-[13px]" placeholder="Search business, city, contact, ID" value={f.q} onChange={(e) => set('q', e.target.value)} />
        </label>
        <Segmented size="sm" value={f.source} onChange={(v) => set('source', v)} options={[{ value: '', label: 'All' }, { value: 'digital', label: 'Digital' }, { value: 'historical', label: 'Historical' }]} />
        <Select value={f.segment} onChange={(v) => set('segment', v)} options={SEGMENTS} />
        <Select value={f.priority} onChange={(v) => set('priority', v)} options={[['', 'Any priority'], ['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low']]} />
        <Select value={f.route} onChange={(v) => set('route', v)} options={ROUTES.map((r) => [r, r || 'Any owner'])} />
        <Select value={f.followup} onChange={(v) => set('followup', v)} options={[['', 'Any status'], ...(meta?.followupStatuses || []).map((x) => [x, x])]} />
        {loading && <Spinner size={15} className="text-ink-4 ml-1" />}
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="c-table w-full text-[13px] min-w-[980px]">
            <thead>
              <tr><th className="w-[120px]">Propensity</th><th>Business</th><th>Reached → why they dropped</th><th>Owner</th><th>Follow-up</th><th className="w-8" /></tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r.id)} className={cx('cursor-pointer hover:bg-canvas/70', open === r.id && 'bg-canvas')}>
                  <td><Score value={r.score} priority={r.priority} /></td>
                  <td>
                    <p className="font-semibold flex items-center gap-2">{r.businessName}{r.kind === 'digital' && <span className="pill pill-brand">Digital</span>}</p>
                    <p className="text-2xs text-ink-4 mt-0.5">{r.businessType} · {r.city}{r.tier ? ` (T${r.tier})` : ''} · {r.segment}</p>
                  </td>
                  <td>
                    <p className="text-ink-2"><span className="font-medium">{r.stage}</span> <span className="text-ink-4">→</span> {r.reason}</p>
                    <p className="text-2xs mt-0.5 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: r.reasonKind === 'friction' ? '#E40000' : '#3E6CC4' }} />
                      <span className="text-ink-4">{r.reasonKind === 'friction' ? 'Our process' : 'Market'} · {r.source}</span>
                    </p>
                  </td>
                  <td className="text-ink-2 whitespace-nowrap">{r.route}</td>
                  <td><span className={cx('pill', FU_TONE[r.followup])}>{r.followup}</span></td>
                  <td className="text-ink-4"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.rows.length && <Empty icon={Search} title="No leads match these filters" />}
        </div>
        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line text-[13px] text-ink-3">
            <span className="num">{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total.toLocaleString('en-IN')}</span>
            <span className="flex gap-1">
              <button className="btn btn-secondary btn-sm px-2" disabled={f.page <= 1} onClick={() => set('page', f.page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
              <button className="btn btn-secondary btn-sm px-2" disabled={f.page >= pages} onClick={() => set('page', f.page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
            </span>
          </div>
        )}
      </section>

      {open && <LeadDrawer id={open} onClose={() => setOpen(null)} onSaved={load} />}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-9 w-auto pr-8 text-[13px] text-ink-2">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Score({ value, priority }) {
  const tone = priority === 'High' ? 'bg-brand-600' : priority === 'Medium' ? 'bg-ink-2' : 'bg-ink-4/60';
  return (
    <span className="flex items-center gap-2.5">
      <span className="num w-7 text-[14px] font-bold text-right">{value}</span>
      <span className="h-1.5 w-14 rounded-full bg-line-2 overflow-hidden"><span className={cx('block h-full rounded-full', tone)} style={{ width: `${value}%` }} /></span>
    </span>
  );
}

const DRIVER_LABEL = { segment: 'Segment', lead_source: 'Source', has_gstin: 'Has GSTIN', current_internet: 'Internet today', annual_turnover_band: 'Turnover', stage_reached: 'Stage reached', drop_reason: 'Drop reason' };

function LeadDrawer({ id, onClose, onSaved }) {
  const { meta } = useApp();
  const [l, setL] = useState(null);
  const [status, setStatus] = useState('New');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setL(null); setAi(null); setSaved(false);
    api.get(`/leads/${id}`).then((x) => { setL(x); setStatus(x.followup || 'New'); setNote(x.followupNote || ''); });
  }, [id]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const save = async () => {
    setSaving(true);
    await api.post(`/leads/${id}/followup`, { status, note });
    setSaving(false); setSaved(true); onSaved();
    setTimeout(() => setSaved(false), 1800);
  };
  const suggest = async () => { setAiBusy(true); try { setAi(await api.post(`/leads/${id}/suggest`)); } finally { setAiBusy(false); } };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col animate-rise" role="dialog" aria-modal="true">
        <div className="h-14 px-5 flex items-center justify-between border-b border-line shrink-0">
          <span className="pill pill-neutral num">{id}</span>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:bg-canvas" aria-label="Close"><X size={18} /></button>
        </div>
        {!l ? <div className="grid place-items-center flex-1"><Spinner className="text-ink-4" /></div> : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-5 pb-4">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">{l.businessName}</h2>
              <p className="text-[13px] text-ink-3 mt-0.5">{l.businessType} · {l.city} · {l.employees ?? '—'} people{l.sites > 1 ? ` · ${l.sites} sites` : ''}</p>
              <p className="text-[13px] text-ink-3">{l.contactName ? `${l.contactName}${l.contactRole ? ` (${l.contactRole})` : ''} · ` : ''}prefers {({ en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', gu: 'Gujarati' })[l.language] || l.language}</p>
              <div className="mt-4 grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-line bg-line text-[12px]">
                <Stat icon={Gauge} label="Propensity" value={`${l.score} · ${l.priority}`} />
                <Stat icon={Route} label="Owner" value={l.route} />
                <Stat icon={Zap} label="Potential" value={l.expectedMonthly ? `${inr(l.expectedMonthly)}/mo` : '—'} />
              </div>
            </div>

            <Section title="Recommended play">
              <p className="text-[13px] text-ink-2 leading-relaxed">{l.play}</p>
              <p className="mt-1.5 text-2xs text-ink-4">Channel: {l.channel} · Lost at <b className="font-semibold text-ink-3">{l.stage}</b> — {l.reason}</p>
            </Section>

            <Section title="AI-drafted approach" right={
              <button className="btn btn-secondary btn-sm" onClick={suggest} disabled={aiBusy}>{aiBusy ? <Spinner size={13} /> : <Sparkles size={13} className="text-brand-600" />}{ai ? 'Redraft' : 'Draft'}</button>}>
              {!ai && !aiBusy && <p className="text-[13px] text-ink-4">Draft a personalised opener in the owner's language, based on why they dropped out.</p>}
              {ai && (
                <div className="space-y-3 animate-rise">
                  <div className="rounded-lg bg-canvas border border-line p-3">
                    <p className="flex items-center justify-between text-2xs font-semibold text-ink-3 mb-1.5">
                      <span className="flex items-center gap-1.5"><MessageCircle size={12} />Opener</span>
                      <button onClick={() => { navigator.clipboard?.writeText(ai.opener); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1 hover:text-ink">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button>
                    </p>
                    <p className="text-[13px] text-ink leading-relaxed">{ai.opener}</p>
                  </div>
                  <ul className="space-y-1.5">{ai.points.map((p) => <li key={p} className="flex gap-2 text-[13px] text-ink-2"><span className="mt-2 h-1 w-1 rounded-full bg-ink-3 shrink-0" />{p}</li>)}</ul>
                  <p className="text-2xs text-ink-4">{ai.source === 'llm' ? 'Drafted by Gemini from this lead’s record' : 'Template draft (AI key not set)'}</p>
                </div>
              )}
            </Section>

            {l.drivers && (
              <Section title="Why this score">
                <ul className="space-y-1.5">
                  {l.drivers.map((d) => (
                    <li key={d.attr} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-[12px]">
                      <span className="text-ink-3">{DRIVER_LABEL[d.attr]}</span>
                      <span className="truncate text-ink-2" title={String(d.value)}>{String(d.value)}</span>
                      <span className={cx('num text-right font-semibold', d.lift > 1.05 ? 'text-ok' : d.lift < 0.95 ? 'text-bad' : 'text-ink-4')}>×{d.lift}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-2xs text-ink-4">Lift vs. the 7.4% base activation rate, learned from smb_leads.csv; ranked as a percentile among dropped leads.</p>
              </Section>
            )}

            {l.timeline?.length > 0 && (
              <Section title="History">
                <ol className="space-y-1">{l.timeline.map((t) => <li key={t.label} className="flex justify-between text-[12px]"><span className="text-ink-3">{t.label}</span><span className="num text-ink-2">{fmtDate(t.date, { day: 'numeric', month: 'short' })}</span></li>)}</ol>
              </Section>
            )}

            <Section title="Update follow-up">
              <div className="flex flex-wrap gap-1.5">
                {(meta?.followupStatuses || []).map((s) => <button key={s} onClick={() => setStatus(s)} className={cx('chip h-8 text-[12px]', status === s && 'chip-on')}>{s}</button>)}
              </div>
              <textarea className="field h-20 py-2 mt-3 resize-none text-[13px]" placeholder="Add a note for the team (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <button className="btn btn-dark w-full mt-3" onClick={save} disabled={saving}>{saving ? <Spinner /> : saved ? <Check size={16} /> : null}{saved ? 'Saved' : 'Save follow-up'}</button>
            </Section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <section className="px-5 py-4 border-t border-line">
      <div className="flex items-center justify-between mb-2.5"><h3 className="text-[13px] font-bold">{title}</h3>{right}</div>
      {children}
    </section>
  );
}
function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white px-3 py-2.5">
      <p className="flex items-center gap-1 text-2xs text-ink-4"><Icon size={11} />{label}</p>
      <p className="mt-0.5 font-semibold text-ink truncate">{value}</p>
    </div>
  );
}
