import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Clock, MessageSquareText, ReceiptText, ScanLine, PackageCheck, Wifi, Smartphone, Receipt, Check } from 'lucide-react';
import SiteHeader from '../components/SiteHeader.jsx';
import { Spinner, ErrorNote } from '../components/ui.jsx';
import { useApp } from '../lib/app.jsx';
import { api } from '../lib/api.js';
import { inr, cx } from '../lib/format.js';

const EXAMPLE = [['P01', 1, Wifi], ['P07', 2, Smartphone], ['P19', 1, Receipt]];

export default function Home() {
  const { t, lang, setLang, meta, lastApp, setLastApp, product } = useApp();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [orderId, setOrderId] = useState('');

  const start = async () => {
    setBusy(true); setErr('');
    try {
      const app = await api.post('/applications', { language: lang });
      setLastApp(app.id);
      nav(`/apply/${app.id}`, { state: { fresh: app } });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  // Example bundle priced with the same rule as the server (12-month term = midpoint of catalogue band).
  const ex = EXAMPLE.map(([id, qty, Icon]) => {
    const p = product(id);
    return p ? { id, qty, Icon, name: p.name, price: Math.ceil((p.priceMin + p.priceMax) / 2) * qty } : null;
  }).filter(Boolean);
  const exTotal = ex.reduce((s, x) => s + x.price, 0);
  const langs = meta?.languages || [];

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_85%_0%,#FFF2F2_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 pt-12 sm:pt-20 pb-14 grid lg:grid-cols-[1.05fr_.95fr] gap-12 lg:gap-16 items-center">
            <div className="animate-rise">
              <p className="eyebrow text-brand-700">{t('hero_eyebrow')}</p>
              <h1 className="mt-4 text-[36px] sm:text-[52px] leading-[1.04] font-extrabold tracking-[-0.035em] text-balance">{t('hero_title')}</h1>
              <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-ink-3 max-w-[540px] text-pretty">{t('hero_sub')}</p>

              <div className="mt-8">
                <p className="label">{t('hero_lang')}</p>
                <div className="flex flex-wrap gap-2">
                  {langs.filter((l) => l.available).map((l) => (
                    <button key={l.code} type="button" onClick={() => setLang(l.code)} title={l.label}
                      className={cx('chip', lang === l.code && 'chip-on')}>
                      {l.native}
                    </button>
                  ))}
                </div>
                {langs.some((l) => !l.available) && (
                  <p className="mt-2 text-2xs text-ink-4">{langs.filter((l) => !l.available).map((l) => l.native).join(' · ')} available when the AI key is configured.</p>
                )}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                <button className="btn btn-primary btn-lg w-full sm:w-auto" onClick={start} disabled={busy || !meta}>
                  {busy ? <Spinner /> : null}{t('hero_cta')}{!busy && <ArrowRight size={18} />}
                </button>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3"><Clock size={15} />{t('hero_time')}</span>
              </div>
              {lastApp && <Link to={`/apply/${lastApp}`} className="mt-4 inline-block text-[13px] link">{t('hero_resume')} →</Link>}
              <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
            </div>

            {/* Product preview: a real bundle priced from the catalogue */}
            <div className="relative animate-rise [animation-delay:.08s] mx-auto w-full max-w-[460px]">
              <div className="card shadow-lift p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Example bundle</p>
                    <p className="mt-1 font-semibold">Kirana store · Jaipur · 2 people</p>
                  </div>
                  <span className="pill pill-ok"><Check size={12} strokeWidth={3} />Eligible</span>
                </div>
                <ul className="mt-5 space-y-3">
                  {ex.map((x) => (
                    <li key={x.id} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-canvas border border-line text-ink-2"><x.Icon size={17} /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-medium truncate">{x.name}</span>
                        <span className="block text-2xs text-ink-4">× {x.qty}</span>
                      </span>
                      <span className="num text-[14px] font-semibold">{inr(x.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-5 divider">
                  <p className="text-2xs text-ink-4">One bill, one support number</p>
                  <p className="num text-[30px] font-extrabold tracking-tight leading-none mt-1.5">{inr(exTotal)}<span className="text-[14px] font-semibold text-ink-3">/month</span></p>
                  <p className="mt-1.5 text-2xs text-ink-4">+ 18% GST · 12-month term</p>
                </div>
              </div>
              <div className="card shadow-lift absolute -bottom-7 -right-3 sm:-right-8 px-4 py-3 hidden sm:flex items-center gap-3 w-[240px]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ok-bg text-ok"><PackageCheck size={18} /></span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold">Installation scheduled</span>
                  <span className="block text-2xs text-ink-4">Thu, 12:00–15:00 · no calls needed</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-canvas">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 grid gap-8 lg:grid-cols-[1fr_340px] items-start">
            <ol className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-7">
              {[[MessageSquareText, 'how_1'], [ReceiptText, 'how_2'], [ScanLine, 'how_3'], [PackageCheck, 'how_4']].map(([Icon, k], i) => (
                <li key={k} className="relative">
                  <div className="flex items-center gap-2 text-ink-4">
                    <span className="num text-2xs font-semibold">0{i + 1}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <Icon size={20} className="mt-4 text-brand-600" />
                  <p className="mt-2 font-semibold text-[14px]">{t(k + '_t')}</p>
                  <p className="mt-1 text-[13px] text-ink-3">{t(k + '_d')}</p>
                </li>
              ))}
            </ol>
            <form className="card p-4" onSubmit={(e) => { e.preventDefault(); if (orderId.trim()) nav(`/track/${orderId.trim().toUpperCase()}`); }}>
              <p className="font-semibold text-[14px]">{t('track_title')}</p>
              <div className="mt-3 flex gap-2">
                <input className="field h-10" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder={t('track_placeholder')} aria-label="Order ID" />
                <button className="btn btn-dark">{t('track_go')}</button>
              </div>
            </form>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 text-2xs text-ink-4 flex flex-wrap gap-x-4 gap-y-1 justify-between">
        <span>Prototype for YTL Hackathon 2026 · Track A. Accel Telecom is fictional; all data is synthetic.</span>
        <span>AI: {meta?.llm?.enabled ? `Gemini (${meta.llm.model})` : 'rule-based mode'}</span>
      </footer>
    </div>
  );
}
