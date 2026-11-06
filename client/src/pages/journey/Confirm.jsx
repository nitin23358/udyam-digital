import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, PenLine, ShieldCheck, ArrowRight } from 'lucide-react';
import { Spinner, ErrorNote, Segmented } from '../../components/ui.jsx';
import { PriceCard } from './Bundle.jsx';
import { useApp } from '../../lib/app.jsx';
import { api } from '../../lib/api.js';
import { cx, inr } from '../../lib/format.js';
import { PRODUCT_ICON } from '../../lib/products.js';

export default function Confirm({ app, onBack, onDone }) {
  const { t } = useApp();
  const [slots, setSlots] = useState(null);
  const [date, setDate] = useState('');
  const [win, setWin] = useState('');
  const [name, setName] = useState(app.kyc?.applicantName || app.contactName || '');
  const [phone, setPhone] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/applications/${app.id}/slots`).then((s) => { setSlots(s); setDate(s.dates[0]); setWin(s.windows[1]); }).catch((e) => setErr(e.message));
  }, [app.id]);

  const place = async () => {
    setBusy(true); setErr('');
    try {
      const out = await api.post(`/applications/${app.id}/order`, { contactName: name, phone, date, window: win, accept });
      onDone(out.orderId);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const phoneOk = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10));
  const address = app.kyc?.facts?.installAddress || app.kyc?.facts?.address;
  const quote = app.quote;

  return (
    <div className="flex-1 mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-6 lg:py-8 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8 items-start">
      <div className="min-w-0 space-y-5">
        <header>
          <button className="btn btn-ghost btn-sm -ml-3 mb-2" onClick={onBack}><ArrowLeft size={15} />{t('back')}</button>
          <h1 className="text-[26px] sm:text-[28px] font-extrabold tracking-[-0.03em]">{t('o_title')}</h1>
          <p className="mt-1.5 text-ink-3">Your business is verified. Pick a time for the engineer — you won't need to call anyone.</p>
        </header>

        <section className="card card-pad">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold"><CalendarDays size={16} className="text-ink-3" />{t('o_slot')}</h2>
          {slots ? (
            <>
              <p className="mt-1 text-[13px] text-ink-3">Earliest date is based on the longest install time in your bundle ({slots.leadDays} days).</p>
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {slots.dates.map((d) => {
                  const dt = new Date(d + 'T00:00:00');
                  const on = d === date;
                  return (
                    <button key={d} type="button" onClick={() => setDate(d)}
                      className={cx('rounded-xl border py-2.5 text-center transition-colors', on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink-4/60')}>
                      <span className={cx('block text-2xs font-semibold uppercase', on ? 'text-white/70' : 'text-ink-4')}>{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                      <span className="block num text-[18px] font-bold leading-tight">{dt.getDate()}</span>
                      <span className={cx('block text-2xs', on ? 'text-white/70' : 'text-ink-4')}>{dt.toLocaleDateString('en-IN', { month: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4"><Segmented value={win} onChange={setWin} options={slots.windows.map((w) => ({ value: w, label: w }))} /></div>
            </>
          ) : <div className="py-6"><Spinner className="text-ink-4" /></div>}
        </section>

        <section className="card card-pad">
          <h2 className="text-[14px] font-semibold">{t('o_contact')}</h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div><label className="label" htmlFor="cn">Name</label><input id="cn" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div>
              <label className="label" htmlFor="ph">{t('o_mobile')}</label>
              <div className="flex">
                <span className="h-11 px-3 grid place-items-center rounded-l-[10px] border border-r-0 border-line bg-canvas text-[14px] text-ink-3">+91</span>
                <input id="ph" className="field rounded-l-none num" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 11))} inputMode="numeric" placeholder="98765 43210" autoComplete="tel-national" />
              </div>
            </div>
          </div>
          {address && (
            <div className="mt-5 flex gap-3 rounded-xl bg-canvas border border-line px-4 py-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-ink-3" />
              <div>
                <p className="text-2xs font-semibold text-ink-3">{t('o_address')} · from your verified documents</p>
                <p className="text-[13px] text-ink-2 mt-0.5">{address}</p>
              </div>
            </div>
          )}
        </section>

        <label className="card card-pad flex gap-3 cursor-pointer">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-[#101014] shrink-0" />
          <span>
            <span className="flex items-center gap-2 text-[14px] font-semibold"><PenLine size={15} />E-sign</span>
            <span className="block text-[13px] text-ink-3 mt-0.5">{t('o_esign')} <span className="text-ink-4">(Simulated in this prototype.)</span></span>
          </span>
        </label>
        {err && <ErrorNote>{err}</ErrorNote>}
      </div>

      <aside className="lg:sticky lg:top-[88px] space-y-4">
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line-2">
            {quote?.lines?.map((l) => {
              const Icon = PRODUCT_ICON[l.productId];
              return (
                <li key={l.productId} className="flex items-center gap-3 px-5 py-2.5">
                  <Icon size={15} className="text-ink-4 shrink-0" />
                  <span className="flex-1 min-w-0 text-[13px] truncate">{l.name}{l.qty > 1 && <span className="text-ink-4"> × {l.qty}</span>}</span>
                  <span className="num text-[13px] font-medium">{inr(l.monthly)}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <PriceCard quote={quote} compact />
        <button className="btn btn-primary btn-lg w-full" disabled={!date || !win || !name.trim() || !phoneOk || !accept || busy} onClick={place}>
          {busy && <Spinner />}{t('o_place')} · {inr(quote?.monthly)}{t('per_month')}<ArrowRight size={17} />
        </button>
        <p className="text-2xs text-ink-4 text-center flex items-center justify-center gap-1.5"><ShieldCheck size={13} />{t('p_nothing')}</p>
      </aside>
    </div>
  );
}
