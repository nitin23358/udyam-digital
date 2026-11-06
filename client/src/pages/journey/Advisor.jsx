import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Mic, MicOff, Building2, MapPin, Users, Store, Wifi, ListChecks, BadgeCheck, ArrowRight, Sparkles, CircleSlash, ChevronRight } from 'lucide-react';
import { Logo, TypingDots, ErrorNote } from '../../components/ui.jsx';
import { useApp } from '../../lib/app.jsx';
import { api } from '../../lib/api.js';
import { inr, cx } from '../../lib/format.js';
import { PRODUCT_ICON } from '../../lib/products.js';

const SEGMENT_LABEL = { micro: 'Shop / local service', prof: 'Professional office', multi: 'Multi-site business', mfg: 'Manufacturer' };
const SPEECH_LANG = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN', gu: 'gu-IN' };

export default function Advisor({ app, patch, onNext, onRecommended }) {
  const { t, meta } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [multi, setMulti] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const q = app.question;
  const rec = app.recommendation;

  useEffect(() => { setMulti(q?.multi ? new Set(q.defaults || []) : null); }, [q?.slot, q?.multi]); // eslint-disable-line
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [app.transcript?.length, busy, rec]);

  const send = async (payload, echo) => {
    setBusy(true); setErr('');
    // Optimistically show the owner's reply.
    patch({ transcript: [...app.transcript, { role: 'user', text: echo, ts: new Date().toISOString(), pending: true }], question: null });
    try {
      const out = await api.post(`/applications/${app.id}/advisor`, payload);
      // Stay on the advisor to show the recommendation (instead of auto-jumping to the next step).
      if (out.recommendation) onRecommended?.();
      patch({
        transcript: out.transcript, profile: out.profile, question: out.question, stage: out.stage,
        recommendation: out.recommendation, quote: out.quote, selection: out.selection,
      });
      setText('');
    } catch (e) {
      setErr(e.message);
      patch({ question: q, transcript: app.transcript });
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };
  const answer = (value, label) => send({ answer: { slot: q.slot, value, label } }, label);
  const submitText = (e) => {
    e?.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    if (q?.slot === 'gstin' && /^[0-9A-Za-z]{15}$/.test(v)) return answer(v.toUpperCase(), v.toUpperCase());
    send({ text: v }, v);
  };

  // Voice input (Web Speech API, where the browser supports it).
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const toggleMic = () => {
    if (!SR) return;
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = SPEECH_LANG[app.language] || 'en-IN';
    r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const transcript = app.transcript || [];
  const lastQuestionIdx = transcript.map((m) => m.kind).lastIndexOf('question');

  return (
    <div className="flex-1 mx-auto w-full max-w-[1200px] px-0 sm:px-6 lg:py-6 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
      {/* Conversation */}
      <section className="bg-white sm:border sm:border-line sm:rounded-2xl sm:shadow-card flex flex-col min-h-[calc(100vh-8.5rem)] lg:min-h-[640px] lg:max-h-[calc(100vh-10rem)]">
        <MobileProfile profile={app.profile} />
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 pb-4">
          <div className="max-w-[640px] mx-auto space-y-5">
            {transcript.map((m, i) => (
              <Message key={i} m={m} first={i === 0 || transcript[i - 1].role !== m.role} isCurrentQ={i === lastQuestionIdx && !!q} />
            ))}
            {busy && <div className="pl-9"><TypingDots label={t('thinking')} /></div>}
            {rec && !busy && <Recommendation rec={rec} quote={app.quote} reasons={app.selection?.reasons} onNext={onNext} />}
            <div ref={endRef} />
          </div>
        </div>

        {/* Composer */}
        {q && (
          <div className="border-t border-line bg-white/95 backdrop-blur px-4 sm:px-8 pt-3 pb-4 sm:rounded-b-2xl sticky bottom-0">
            <div className="max-w-[640px] mx-auto">
              {err && <div className="mb-3"><ErrorNote>{err}</ErrorNote></div>}
              {q.chips?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Quick answers">
                  {q.chips.map((c) => {
                    const on = multi?.has(c.value);
                    return (
                      <button key={String(c.value)} type="button" disabled={busy}
                        className={cx('chip', on && 'chip-on')}
                        onClick={() => {
                          if (q.multi) { const s = new Set(multi); on ? s.delete(c.value) : s.add(c.value); setMulti(s); }
                          else if (c.value === '__other') { inputRef.current?.focus(); }
                          else answer(c.value, c.label);
                        }}>
                        {c.label}
                      </button>
                    );
                  })}
                  {q.multi && (
                    <button type="button" className="btn btn-dark btn-sm h-9 rounded-full px-4" disabled={busy || !multi?.size}
                      onClick={() => answer([...multi], q.chips.filter((c) => multi.has(c.value)).map((c) => c.label).join(', '))}>
                      {q.doneLabel || 'Done'} <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
              <form onSubmit={submitText} className="flex items-center gap-2 rounded-xl border border-line bg-white pl-4 pr-1.5 h-12 focus-within:border-brand-600/50 focus-within:shadow-focus transition-shadow">
                <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} autoFocus
                  placeholder={q.slot === 'gstin' ? t('composer_ph_gstin') : t('composer_ph')}
                  className={cx('flex-1 bg-transparent text-[15px] focus:outline-none focus-visible:shadow-none placeholder:text-ink-4 min-w-0', q.slot === 'gstin' && 'uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal')}
                  inputMode={q.input === 'number' ? 'numeric' : 'text'} maxLength={q.slot === 'gstin' ? 20 : 500} aria-label={q.text} />
                {SR && (
                  <button type="button" onClick={toggleMic} className={cx('h-9 w-9 grid place-items-center rounded-lg transition-colors', listening ? 'bg-brand-50 text-brand-700' : 'text-ink-4 hover:text-ink hover:bg-canvas')} aria-label="Speak your answer">
                    {listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
                <button type="submit" disabled={!text.trim() || busy} className="h-9 w-9 grid place-items-center rounded-lg bg-brand-600 text-white disabled:bg-line disabled:text-ink-4 transition-colors" aria-label={t('send')}>
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              </form>
              <p className="mt-2 text-2xs text-ink-4 text-center">
                {meta?.llm?.enabled ? 'AI understands free text in your language · prices come only from the Accel catalogue' : 'Rule-based advisor (no AI key set) · prices come only from the Accel catalogue'}
              </p>
            </div>
          </div>
        )}
      </section>

      <aside className="hidden lg:block">
        <div className="sticky top-[88px]"><ProfilePanel profile={app.profile} /></div>
      </aside>
    </div>
  );
}

function Message({ m, first, isCurrentQ }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end animate-rise">
        <p className={cx('max-w-[85%] rounded-2xl rounded-br-md bg-ink text-white px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap', m.pending && 'opacity-70')}>{m.text}</p>
      </div>
    );
  }
  return (
    <div className="flex gap-3 animate-rise">
      <span className={cx('mt-0.5 w-6 shrink-0', !first && 'invisible')}><Logo compact /></span>
      <p className={cx('text-[15px] leading-relaxed text-pretty', m.kind === 'question' ? (isCurrentQ ? 'text-ink font-semibold' : 'text-ink-2 font-medium') : 'text-ink-2')}>{m.text}</p>
    </div>
  );
}

function Recommendation({ rec, quote, reasons, onNext }) {
  const { t } = useApp();
  return (
    <div className="ml-0 sm:ml-9 animate-rise">
      <div className="rounded-2xl border border-line bg-white shadow-lift overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4">
          <p className="eyebrow flex items-center gap-1.5 text-brand-700"><Sparkles size={13} />{t('rec_title')}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2 text-pretty">{rec.summary}</p>
        </div>
        <ul className="border-t border-line divide-y divide-line-2">
          {rec.items.map((i) => {
            const Icon = PRODUCT_ICON[i.productId];
            const line = quote?.lines?.find((l) => l.productId === i.productId);
            return (
              <li key={i.productId} className="flex gap-3 px-5 sm:px-6 py-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas border border-line text-ink-2"><Icon size={16} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold">{i.name}{i.qty > 1 && <span className="font-medium text-ink-4"> × {i.qty}</span>}</p>
                  <p className="text-[13px] text-ink-3 leading-snug">{reasons?.[i.productId] || i.reasonText}</p>
                </div>
                {line && <span className="num text-[13px] font-semibold text-ink-2 pt-0.5">{inr(line.monthly)}</span>}
              </li>
            );
          })}
        </ul>
        {rec.unavailable?.length > 0 && (
          <div className="border-t border-line px-5 sm:px-6 py-3 bg-canvas/60">
            <p className="text-2xs font-semibold text-ink-3 flex items-center gap-1.5"><CircleSlash size={12} />{t('rec_not_available')}</p>
            <ul className="mt-1.5 space-y-1">
              {rec.unavailable.map((u) => <li key={u.productId} className="text-[13px] text-ink-3"><span className="font-medium text-ink-2">{u.name}</span> — {u.why[0]}</li>)}
            </ul>
          </div>
        )}
        <div className="border-t border-line px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-white">
          {quote && (
            <p className="leading-none">
              <span className="num text-[26px] font-extrabold tracking-tight">{inr(quote.monthly)}</span>
              <span className="text-[13px] font-semibold text-ink-3">{t('per_month')}</span>
              <span className="ml-2 text-2xs text-ink-4">{t('plus_gst')} · {quote.term} {t('p_months')}</span>
            </p>
          )}
          <button className="btn btn-primary" onClick={onNext}>{t('rec_cta')}<ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function rows(profile, t) {
  const p = profile || {};
  return [
    [Building2, t('f_business'), p.businessName || p.businessType, p.segment && SEGMENT_LABEL[p.segment]],
    [MapPin, t('f_city'), p.city, p.city ? `Tier ${p.tier}${p.cityKnown === false ? ' · to confirm' : ''}` : null],
    [Users, t('f_people'), p.employees],
    [Store, t('f_sites'), p.sites],
    [Wifi, t('f_internet'), p.currentInternet],
  ];
}

function ProfilePanel({ profile }) {
  const { t, meta, lang } = useApp();
  const p = profile || {};
  const empty = !p.businessType && !p.city;
  const gst = p.gstinStatus;
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <p className="font-semibold text-[14px]">{t('profile_title')}</p>
        <span className="pill pill-neutral">Live</span>
      </div>
      {empty && <p className="px-5 pt-4 text-[13px] text-ink-4">{t('profile_empty')}</p>}
      <dl className="px-5 py-2">
        {rows(p, t).map(([Icon, label, value, sub]) => (
          <div key={label} className="flex items-start gap-3 py-2.5">
            <Icon size={16} className={cx('mt-0.5 shrink-0', value ? 'text-ink-2' : 'text-ink-4/60')} />
            <dt className="w-24 shrink-0 text-[13px] text-ink-3">{label}</dt>
            <dd className="flex-1 min-w-0 text-right">
              {value ? (
                <span className="animate-rise block">
                  <span className="block text-[13px] font-semibold text-ink truncate">{value}</span>
                  {sub && <span className="block text-2xs text-ink-4">{sub}</span>}
                </span>
              ) : <span className="inline-block h-2 w-14 rounded-full bg-line-2" />}
            </dd>
          </div>
        ))}
        <div className="py-2.5">
          <div className="flex items-center gap-3">
            <ListChecks size={16} className={cx('shrink-0', p.needs?.length ? 'text-ink-2' : 'text-ink-4/60')} />
            <dt className="flex-1 text-[13px] text-ink-3">{t('f_needs')}</dt>
            {!p.needs?.length && <span className="inline-block h-2 w-14 rounded-full bg-line-2" />}
          </div>
          {p.needs?.length > 0 && (
            <dd className="mt-2 pl-7 flex flex-wrap gap-1.5 animate-rise">
              {p.needs.map((n) => <span key={n} className="pill pill-neutral h-auto py-1 whitespace-normal text-left">{meta?.needs?.[n]?.[lang === 'hi' ? 'hi' : 'en'] || n}</span>)}
            </dd>
          )}
        </div>
        <div className="flex items-start gap-3 py-2.5">
          <BadgeCheck size={16} className={cx('mt-0.5 shrink-0', gst ? 'text-ink-2' : 'text-ink-4/60')} />
          <dt className="w-24 shrink-0 text-[13px] text-ink-3">{t('f_gstin')}</dt>
          <dd className="flex-1 text-right">
            {gst === 'Active' && <span className="pill pill-ok">Active</span>}
            {gst && gst !== 'Active' && <span className="pill pill-bad">{gst}</span>}
            {!gst && p.gstinAsked && <span className="pill pill-neutral">Not provided</span>}
            {!gst && !p.gstinAsked && <span className="inline-block h-2 w-14 rounded-full bg-line-2" />}
          </dd>
        </div>
      </dl>
      <p className="px-5 py-3 border-t border-line text-2xs text-ink-4 leading-relaxed">
        Used only to build your quote. GSTIN checks run against a mock registry in this prototype.
      </p>
    </div>
  );
}

function MobileProfile({ profile }) {
  const { t } = useApp();
  const items = rows(profile, t).filter(([, , v]) => v);
  if (!items.length) return null;
  return (
    <div className="lg:hidden border-b border-line px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
      {items.map(([Icon, label, value]) => (
        <span key={label} className="pill pill-neutral h-7 shrink-0"><Icon size={12} />{value}</span>
      ))}
    </div>
  );
}
