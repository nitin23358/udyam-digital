import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Lock, CircleSlash, ChevronDown, Info, Timer, ArrowRight, Sparkles, AlertTriangle, Plus } from 'lucide-react';
import { QtyStepper, Toggle, Segmented, Spinner, ErrorNote } from '../../components/ui.jsx';
import { useApp } from '../../lib/app.jsx';
import { api } from '../../lib/api.js';
import { inr, cx } from '../../lib/format.js';
import { PRODUCT_ICON, unitWord, LINK_IDS } from '../../lib/products.js';

export default function Bundle({ app, patch, onNext }) {
  const { t, product } = useApp();
  const rec = app.recommendation || {};
  const [lines, setLines] = useState(app.selection?.lines || []);
  const [term, setTerm] = useState(app.selection?.term || 12);
  const [quote, setQuote] = useState(app.quote);
  const [pricing, setPricing] = useState(false);
  const [err, setErr] = useState('');
  const first = useRef(true);
  const reasons = app.selection?.reasons || {};

  // Persist + re-price on every change (server is the single source of truth for prices).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPricing(true);
    const h = setTimeout(async () => {
      try {
        const out = await api.put(`/applications/${app.id}/selection`, { lines, term });
        setQuote(out.quote);
        if (out.quote.term !== term) setTerm(out.quote.term);
        patch({ selection: out.selection, quote: out.quote });
      } catch (e) { setErr(e.message); } finally { setPricing(false); }
    }, 220);
    return () => clearTimeout(h);
  }, [lines, term]); // eslint-disable-line

  const ids = lines.map((l) => l.productId);
  const link = lines.find((l) => LINK_IDS.includes(l.productId));
  const linkOptions = (rec.linkOptions || []).filter((id) => product(id));
  const recQty = Object.fromEntries([...(rec.items || []), ...(rec.addons || [])].map((i) => [i.productId, i.qty]));
  const addable = useMemo(() => {
    const seen = new Set();
    return [...(rec.items || []), ...(rec.addons || [])]
      .filter((i) => !LINK_IDS.includes(i.productId) && !ids.includes(i.productId) && !seen.has(i.productId) && seen.add(i.productId));
  }, [rec, ids.join()]); // eslint-disable-line
  const unavailable = [...(rec.unavailable || []), ...(rec.lockedByGstin || []).filter((u) => !(rec.unavailable || []).some((x) => x.productId === u.productId))];

  const setQty = (id, qty) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, qty } : l)));
  const remove = (id) => setLines((ls) => ls.filter((l) => l.productId !== id));
  const add = (id) => setLines((ls) => [...ls, { productId: id, qty: recQty[id] || 1 }]);
  const swapLink = (id) => setLines((ls) => {
    const qty = link?.qty || app.profile?.sites || 1;
    return [{ productId: id, qty }, ...ls.filter((l) => !LINK_IDS.includes(l.productId))];
  });

  const issueFor = (id) => quote?.issues?.find((i) => i.productId === id);
  const qLine = (id) => quote?.lines?.find((l) => l.productId === id);
  const nonLink = lines.filter((l) => !LINK_IDS.includes(l.productId));

  const goNext = async () => {
    try { await api.put(`/applications/${app.id}/selection`, { lines, term, stage: app.stage === 'quote' ? 'kyc' : app.stage }); patch({ stage: app.stage === 'quote' ? 'kyc' : app.stage }); onNext(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="flex-1 mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-6 lg:py-8 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8 items-start">
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="text-[26px] sm:text-[28px] font-extrabold tracking-[-0.03em]">{t('b_title')}</h1>
          <p className="mt-1.5 text-ink-3 max-w-[620px]">{t('b_sub')}</p>
        </header>

        {app.selection?.summary && (
          <div className="flex gap-3 rounded-xl bg-white border border-line px-4 py-3.5">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-[13px] leading-relaxed text-ink-2">{app.selection.summary}</p>
          </div>
        )}

        {/* Main connection */}
        {linkOptions.length > 0 && (
          <section>
            <SectionTitle>{t('b_connection')}</SectionTitle>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {linkOptions.map((id) => {
                const p = product(id);
                const on = link?.productId === id;
                const Icon = PRODUCT_ICON[id];
                const price = term >= 24 ? p.priceMin : Math.ceil((p.priceMin + p.priceMax) / 2);
                return (
                  <button key={id} type="button" onClick={() => !on && swapLink(id)}
                    className={cx('text-left rounded-xl border bg-white p-4 transition-all', on ? 'border-ink ring-1 ring-ink shadow-card' : 'border-line hover:border-ink-4/60')}>
                    <div className="flex items-center justify-between">
                      <Icon size={18} className={on ? 'text-brand-600' : 'text-ink-3'} />
                      <span className={cx('h-4 w-4 rounded-full border-2', on ? 'border-ink bg-ink shadow-[inset_0_0_0_3px_white]' : 'border-line')} />
                    </div>
                    <p className="mt-3 font-semibold text-[14px]">{p.name}</p>
                    <p className="mt-0.5 text-2xs text-ink-4 line-clamp-2">{p.description}</p>
                    <p className="mt-2 text-[13px]"><span className="num font-semibold">{inr(price)}</span><span className="text-ink-4">/{unitWord(p.unit, 1)}</span>
                      <span className="text-ink-4"> · {p.installDays}d install</span></p>
                  </button>
                );
              })}
            </div>
            {link && reasons[link.productId] && <p className="mt-2 text-[13px] text-ink-3"><span className="font-medium text-ink-2">{t('b_why')}:</span> {reasons[link.productId]}</p>}
          </section>
        )}

        {/* Included */}
        <section>
          <SectionTitle count={nonLink.length}>{t('b_included')}</SectionTitle>
          <ul className="card divide-y divide-line-2">
            {nonLink.map((l) => {
              const p = product(l.productId);
              if (!p) return null;
              const Icon = PRODUCT_ICON[l.productId];
              const ql = qLine(l.productId);
              const issue = issueFor(l.productId);
              return (
                <li key={l.productId} className={cx('p-4 sm:px-5 flex gap-3 sm:gap-4', issue && 'bg-bad-bg/40')}>
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas border border-line text-ink-2"><Icon size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px]">{p.name}</p>
                        <p className="text-[13px] text-ink-3 leading-snug">{p.description}</p>
                      </div>
                      <button onClick={() => remove(l.productId)} className="h-7 w-7 -mr-1 grid place-items-center rounded-md text-ink-4 hover:text-ink hover:bg-canvas shrink-0" aria-label={`${t('b_remove')} ${p.name}`}><X size={15} /></button>
                    </div>
                    {reasons[l.productId] && <p className="mt-1.5 text-[13px] text-ink-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600 mr-2 align-middle" />{reasons[l.productId]}</p>}
                    {issue && <p className="mt-2 text-[13px] text-bad flex gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{issue.fails.map((f) => failText(f, product)).join(' · ')}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="inline-flex items-center gap-2">
                        <QtyStepper value={l.qty} onChange={(v) => setQty(l.productId, v)} label={`Quantity of ${p.name}`} />
                        <span className="text-[13px] text-ink-3">{unitWord(p.unit, l.qty)}</span>
                      </span>
                      {ql && <span className="text-2xs text-ink-4 num">{inr(ql.unitPrice)} × {l.qty}{ql.setup ? ` · ${inr(ql.setup)} ${t('b_setup')}` : ''}</span>}
                      <span className="ml-auto num text-[15px] font-bold">{ql ? inr(ql.monthly) : '—'}<span className="text-2xs font-medium text-ink-4">{t('per_month')}</span></span>
                    </div>
                  </div>
                </li>
              );
            })}
            {!nonLink.length && <li className="p-5 text-[13px] text-ink-4">Nothing added yet.</li>}
          </ul>
        </section>

        {/* Add-ons */}
        {addable.length > 0 && (
          <section>
            <SectionTitle>{t('b_addons')}</SectionTitle>
            <ul className="card divide-y divide-line-2">
              {addable.map((a) => {
                const p = product(a.productId);
                const Icon = PRODUCT_ICON[a.productId];
                const price = term >= 24 ? p.priceMin : Math.ceil((p.priceMin + p.priceMax) / 2);
                return (
                  <li key={a.productId} className="px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
                    <Icon size={17} className="text-ink-3 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium">{p.name}</p>
                      <p className="text-2xs text-ink-4 truncate">{p.description}</p>
                    </div>
                    <span className="num text-[13px] text-ink-3 whitespace-nowrap">{inr(price)}<span className="text-ink-4">/{unitWord(p.unit, 1)}</span></span>
                    <Toggle on={false} onChange={() => add(a.productId)} label={`${t('b_add')} ${p.name}`} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Not available — honest about why */}
        {unavailable.length > 0 && (
          <details className="group rounded-xl border border-line bg-white">
            <summary className="list-none cursor-pointer px-4 sm:px-5 py-3.5 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
              <CircleSlash size={15} className="text-ink-4" />{t('b_unavailable')}<span className="pill pill-neutral ml-1">{unavailable.length}</span>
              <ChevronDown size={16} className="ml-auto text-ink-4 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="border-t border-line divide-y divide-line-2">
              {unavailable.map((u) => (
                <li key={u.productId} className="px-4 sm:px-5 py-3 flex gap-3">
                  {u.fails?.some((f) => f.code === 'gstin') ? <Lock size={15} className="mt-0.5 text-ink-4 shrink-0" /> : <CircleSlash size={15} className="mt-0.5 text-ink-4 shrink-0" />}
                  <div><p className="text-[13px] font-semibold">{u.name}</p><p className="text-[13px] text-ink-3">{u.why.join(' · ')}</p></div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Price summary */}
      <aside className="lg:sticky lg:top-[88px]">
        <PriceCard quote={quote} term={term} setTerm={setTerm} pricing={pricing} cta={t('p_cta')} onCta={goNext} err={err} />
      </aside>
    </div>
  );
}

function SectionTitle({ children, count }) {
  return <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-2">{children}{count != null && <span className="num text-ink-4 font-medium">{count}</span>}</h2>;
}

export function failText(f, product) {
  if (f.code === 'gstin') return f.status === 'Cancelled' || f.status === 'Suspended' ? `Needs an active GSTIN (yours is ${f.status.toLowerCase()})` : 'Needs an active, verified GSTIN';
  if (f.code === 'dependency') return `Needs ${f.options.map((o) => product(o)?.name || o).join(' or ')} in the bundle`;
  if (f.code === 'tier') return 'Not sold in your city yet';
  if (f.code === 'min_employees') return `For businesses with ${f.min}+ people`;
  if (f.code === 'min_sites') return `Needs ${f.min}+ locations`;
  return 'Not available';
}

export function PriceCard({ quote, term, setTerm, pricing, cta, onCta, err, ctaDisabled, compact }) {
  const { t } = useApp();
  if (!quote) return null;
  return (
    <div className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-2">{t('p_title')}</p>
          {pricing && <Spinner size={14} className="text-ink-4" />}
        </div>
        <p className={cx('mt-2 leading-none transition-opacity', pricing && 'opacity-50')}>
          <span className="num text-[40px] font-extrabold tracking-[-0.03em]">{inr(quote.monthly)}</span>
          <span className="text-[14px] font-semibold text-ink-3">{t('per_month')}</span>
        </p>
        <p className="mt-1.5 text-[13px] text-ink-3 num">{t('plus_gst')} {inr(quote.monthlyGst)} = <b className="font-semibold text-ink-2">{inr(quote.monthlyWithGst)}</b>{t('per_month')} incl. GST</p>

        {setTerm && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-3">{t('p_term')}</span>
              <Segmented size="sm" value={quote.term} onChange={setTerm}
                options={[12, 24].map((m) => ({ value: m, label: `${m} ${t('p_months')}`, disabled: !quote.allowedTerms.includes(m) }))} />
            </div>
            {quote.savingsWith24 > 0 && (
              <button type="button" onClick={() => setTerm(24)} className="mt-2 w-full text-left text-[13px] text-ok font-medium">
                {t('p_save', { x: inr(quote.savingsWith24) })} on 24 months →
              </button>
            )}
            {quote.allowedTerms.length === 1 && <p className="mt-2 text-2xs text-ink-4">A product in your bundle needs a 24-month contract.</p>}
          </div>
        )}

        <dl className="mt-5 pt-4 divider space-y-2.5 text-[13px]">
          <Row label={t('p_setup')} value={quote.setup ? inr(quote.setup) : 'Free'} />
          <Row label={t('p_first')} value={inr(quote.firstBill)} hint="incl. GST" />
          <Row label={<span className="inline-flex items-center gap-1.5"><Timer size={14} />{t('p_activation')}</span>} value={`${quote.activationDays} ${t('p_days')}`} />
        </dl>
      </div>
      {!compact && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-3">
          {!quote.valid && quote.issues?.length > 0 && <ErrorNote>Some items need attention before you continue.</ErrorNote>}
          {err && <ErrorNote>{err}</ErrorNote>}
          <button className="btn btn-primary btn-lg w-full" onClick={onCta} disabled={pricing || !quote.valid || ctaDisabled}>{cta}<ArrowRight size={17} /></button>
          <p className="text-2xs text-ink-4 text-center">{t('p_nothing')}</p>
          <details className="text-2xs text-ink-4">
            <summary className="cursor-pointer inline-flex items-center gap-1 hover:text-ink-3"><Info size={12} />{t('p_rule')}</summary>
            <p className="mt-1.5 leading-relaxed">{quote.pricingRule} Setup fees and minimum contracts come straight from the product catalogue.</p>
          </details>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="num font-semibold text-ink">{value}{hint && <span className="ml-1 text-2xs font-medium text-ink-4">{hint}</span>}</dd>
    </div>
  );
}
