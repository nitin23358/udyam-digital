import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { Check, Copy, MessageCircle, MapPin, PartyPopper, PackageSearch, CalendarClock, Wrench } from 'lucide-react';
import SiteHeader from '../components/SiteHeader.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import { useApp } from '../lib/app.jsx';
import { api } from '../lib/api.js';
import { cx, fmtDate, fmtTime, inr } from '../lib/format.js';
import { PRODUCT_ICON } from '../lib/products.js';

export default function Track() {
  const { orderId } = useParams();
  const { state } = useLocation();
  const nav = useNavigate();
  const { t } = useApp();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setOrder(null); setErr('');
    api.get(`/orders/${orderId}`).then(setOrder).catch((e) => setErr(e.message));
    const h = setInterval(() => api.get(`/orders/${orderId}`).then(setOrder).catch(() => {}), 15000);
    return () => clearInterval(h);
  }, [orderId]);

  if (!orderId || err) {
    return (
      <div className="min-h-screen bg-canvas"><SiteHeader />
        <div className="mx-auto max-w-[480px] px-4 py-16">
          <div className="card card-pad">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-canvas border border-line text-ink-3"><PackageSearch size={20} /></span>
            <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em]">{t('nav_track')}</h1>
            <p className="mt-1 text-[13px] text-ink-3">Enter the order ID from your confirmation message.</p>
            {err && <p className="mt-3 text-[13px] text-bad">{err}</p>}
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); q.trim() && nav(`/track/${q.trim().toUpperCase()}`); }}>
              <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('track_placeholder')} autoFocus />
              <button className="btn btn-dark h-11">{t('track_go')}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }
  if (!order) return <div className="min-h-screen bg-canvas"><SiteHeader /><div className="grid place-items-center py-32"><Spinner size={22} className="text-ink-4" /></div></div>;

  const steps = order.timeline;
  const currentIdx = steps.findIndex((s) => !s.done);
  const activated = currentIdx === -1;
  const [slotDate, ...slotWin] = (order.installSlot || '').split(' ');
  const headline = activated ? 'Your services are live' : `Installation on ${fmtDate(slotDate, { weekday: 'long', day: 'numeric', month: 'long' })}`;
  const progress = activated ? 100 : Math.round((currentIdx / steps.length) * 100);

  return (
    <div className="min-h-screen bg-canvas"><SiteHeader />
      <main className="mx-auto max-w-[1080px] px-4 sm:px-6 py-8 lg:py-10">
        {state?.fresh && (
          <div className="mb-5 rounded-xl border border-ok-line bg-ok-bg px-4 py-3 flex items-center gap-3 animate-rise">
            <PartyPopper size={18} className="text-ok shrink-0" />
            <p className="text-[13px] text-ink-2"><b className="font-semibold text-ok">Order placed.</b> Bookmark this page — it always shows the latest status, so there's no need to call.</p>
          </div>
        )}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <section className="card overflow-hidden">
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">{t('t_title')}</span>
                <button onClick={() => { navigator.clipboard?.writeText(order.id); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="pill pill-neutral hover:text-ink num" title="Copy order ID">{order.id}{copied ? <Check size={11} /> : <Copy size={11} />}</button>
              </div>
              <h1 className="mt-3 text-[26px] sm:text-[32px] font-extrabold tracking-[-0.03em] leading-tight">{headline}</h1>
              <p className="mt-1.5 text-ink-3">{activated ? order.businessName : <>{slotWin.join(' ')} · {order.businessName}</>}</p>
              <div className="mt-6 h-1.5 rounded-full bg-line-2 overflow-hidden">
                <div className="h-full rounded-full bg-ink transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <ol className="border-t border-line px-5 sm:px-7 py-6">
              {steps.map((s, i) => {
                const state_ = s.done ? 'done' : i === currentIdx ? 'current' : 'todo';
                return (
                  <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0">
                    {i < steps.length - 1 && <span className={cx('absolute left-[13px] top-8 bottom-1 w-0.5 rounded-full', s.done ? 'bg-ink' : 'bg-line')} />}
                    <span className={cx('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full',
                      state_ === 'done' && 'bg-ink text-white', state_ === 'current' && 'bg-white border-2 border-brand-600', state_ === 'todo' && 'bg-white border-2 border-line')}>
                      {state_ === 'done' && <Check size={14} strokeWidth={3} />}
                      {state_ === 'current' && <span className="h-2.5 w-2.5 rounded-full bg-brand-600 animate-dot" />}
                    </span>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className={cx('text-[15px] font-semibold', state_ === 'todo' && 'text-ink-4')}>{s.label}</p>
                        <p className="text-[13px] text-ink-3 num">
                          {s.done ? `${fmtDate(s.at)}, ${fmtTime(s.at)}` : s.due ? `Expected ${fmtDate(s.due)}` : ''}
                        </p>
                      </div>
                      {s.note && <p className="text-[13px] text-ink-3 mt-0.5">{s.key === 'install_scheduled' ? `Engineer visit ${fmtDate(slotDate)} · ${slotWin.join(' ')}` : s.note}</p>}
                      {state_ === 'current' && s.key === 'activated' && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-700"><Wrench size={13} />Engineer visit {fmtDate(slotDate)} · {slotWin.join(' ')}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <aside className="space-y-4">
            <div className="card overflow-hidden">
              <p className="px-5 pt-4 pb-2 text-[13px] font-semibold">{t('t_items')}</p>
              <ul className="divide-y divide-line-2">
                {order.quote.items?.map((it) => {
                  const Icon = PRODUCT_ICON[it.productId];
                  return (
                    <li key={it.productId} className="flex items-center gap-3 px-5 py-2.5">
                      <Icon size={15} className="text-ink-4 shrink-0" />
                      <span className="flex-1 min-w-0 text-[13px] truncate">{it.name}{it.qty > 1 && <span className="text-ink-4"> × {it.qty}</span>}</span>
                      <span className={cx('pill', activated ? 'pill-ok' : 'pill-neutral')}>{activated ? 'Live' : `Ready by ${fmtDate(it.eta, { day: 'numeric', month: 'short' })}`}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="px-5 py-3 border-t border-line flex items-center justify-between text-[13px]">
                <span className="text-ink-3">Monthly</span>
                <span className="num font-bold">{inr(order.quote.monthly)}<span className="text-2xs font-medium text-ink-4"> + GST</span></span>
              </div>
            </div>
            <div className="card p-5 space-y-3 text-[13px]">
              {order.phoneMasked && <p className="flex gap-2.5"><MessageCircle size={16} className="text-ok shrink-0 mt-0.5" /><span>{t('t_updates')} <b className="num font-semibold">{order.phoneMasked}</b></span></p>}
              {order.installAddress && <p className="flex gap-2.5"><MapPin size={16} className="text-ink-3 shrink-0 mt-0.5" /><span className="text-ink-2">{order.installAddress}</span></p>}
              <p className="flex gap-2.5"><CalendarClock size={16} className="text-ink-3 shrink-0 mt-0.5" /><span className="text-ink-3">Ordered {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}</span></p>
            </div>
            <Link to="/" className="btn btn-ghost w-full">Back to home</Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
