import { useRef, useState } from 'react';
import { ShieldCheck, FileText, IdCard, Receipt, Landmark, Clock4, Scale, Upload, ArrowRight, ArrowLeft, RotateCcw, ChevronDown, FlaskConical, Database, CheckCircle2, AlertCircle, XCircle, Trash2 } from 'lucide-react';
import { Spinner, StatusIcon, ErrorNote } from '../../components/ui.jsx';
import { useApp } from '../../lib/app.jsx';
import { api } from '../../lib/api.js';
import { cx } from '../../lib/format.js';
import { failText } from './Bundle.jsx';

const DOCS = [
  { type: 'gst_certificate', label: 'GST registration certificate', short: 'GST certificate', Icon: Landmark, hint: 'Page 1 with GSTIN, legal and trade name' },
  { type: 'udyam_certificate', label: 'Udyam registration certificate', short: 'Udyam certificate', Icon: FileText, hint: 'Needed if you have no GSTIN' },
  { type: 'signatory_id', label: 'Authorised signatory ID', short: 'Signatory ID', Icon: IdCard, hint: 'ID of the person signing for the business' },
  { type: 'address_proof', label: 'Address proof', short: 'Address proof', Icon: Receipt, hint: 'Electricity or utility bill, under 90 days old' },
];

export default function Verify({ app, patch, reload, onNext, onBack }) {
  if (!app.consent) return <Consent app={app} patch={patch} onBack={onBack} />;
  return <Documents app={app} patch={patch} reload={reload} onNext={onNext} />;
}

/* ---------------- Consent (DPDP Act 2023) ---------------- */
function Consent({ app, patch, onBack }) {
  const { t } = useApp();
  const [kyc, setKyc] = useState(false);
  const [updates, setUpdates] = useState(true);
  const [offers, setOffers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const agree = async () => {
    setBusy(true); setErr('');
    try {
      await api.post(`/applications/${app.id}/consent`, { purposes: ['kyc', ...(updates ? ['order_updates'] : []), ...(offers ? ['offers'] : [])] });
      patch({ consent: true, stage: 'kyc' });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const blocks = [
    [Database, 'What we collect', ['GSTIN or Udyam number and the details on those certificates', 'Name, designation and ID number of the person signing', 'Business address from one recent utility bill']],
    [Scale, 'Why we need it', ['Verify your business, as telecom KYC rules require', 'Check which products you are eligible for', 'Schedule installation at the right address']],
    [Clock4, 'How long we keep it', ['Photos are read in memory and never stored', 'We keep only the check results and masked numbers', 'Deleted when you withdraw consent, or after the retention period the law requires']],
    [ShieldCheck, 'Your rights', ['Withdraw consent at any time from this page', 'Ask to see or correct your data', 'Grievance officer: privacy@accel.example (fictional)']],
  ];
  return (
    <div className="flex-1 mx-auto w-full max-w-[860px] px-4 sm:px-6 py-8 lg:py-12">
      <div className="card overflow-hidden">
        <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-line">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck size={22} /></span>
          <h1 className="mt-4 text-[24px] sm:text-[26px] font-extrabold tracking-[-0.03em]">{t('c_title')}</h1>
          <p className="mt-1.5 text-ink-3 max-w-[600px]">We only ask for what is needed to verify your business and set up your connection. Read how we handle it below.</p>
        </div>
        <div className="grid sm:grid-cols-2">
          {blocks.map(([Icon, title, items], i) => (
            <div key={title} className={cx('px-6 sm:px-8 py-5', i % 2 === 0 && 'sm:border-r border-line', i < 2 && 'border-b border-line', i === 2 && 'border-b sm:border-b-0 border-line')}>
              <p className="flex items-center gap-2 text-[13px] font-semibold"><Icon size={16} className="text-ink-3" />{title}</p>
              <ul className="mt-2.5 space-y-1.5">
                {items.map((x) => <li key={x} className="flex gap-2 text-[13px] text-ink-3"><span className="mt-2 h-1 w-1 rounded-full bg-ink-4 shrink-0" />{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-6 sm:px-8 py-5 border-t border-line bg-canvas/60 space-y-3">
          <Check on={kyc} onChange={setKyc} required title="Verify my business for this order" body="Required. Used only for KYC and eligibility on this application." />
          <Check on={updates} onChange={setUpdates} title="Send order and installation updates on WhatsApp/SMS" body="Optional. Turn off any time." />
          <Check on={offers} onChange={setOffers} title="Send me offers for my business" body="Optional. Not needed for your order." />
        </div>
        <div className="px-6 sm:px-8 py-5 border-t border-line flex flex-col-reverse sm:flex-row gap-3 sm:items-center justify-between">
          <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} />{t('back')}</button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-2xs text-ink-4">Notice v UD-KYC-2026-1 · {app.language === 'hi' ? 'हिन्दी' : 'English'}</span>
            <button className="btn btn-primary btn-lg" disabled={!kyc || busy} onClick={agree}>{busy && <Spinner />}{t('c_agree')}<ArrowRight size={17} /></button>
          </div>
        </div>
        {err && <div className="px-6 sm:px-8 pb-5"><ErrorNote>{err}</ErrorNote></div>}
      </div>
    </div>
  );
}

function Check({ on, onChange, title, body, required }) {
  return (
    <label className="flex gap-3 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-[#101014] shrink-0" />
      <span>
        <span className="block text-[14px] font-semibold">{title}{required && <span className="text-brand-700"> *</span>}</span>
        <span className="block text-[13px] text-ink-3">{body}</span>
      </span>
    </label>
  );
}

/* ---------------- Documents ---------------- */
function Documents({ app, patch, reload, onNext }) {
  const { t, meta, product } = useApp();
  const [files, setFiles] = useState({});           // type -> File
  const [sample, setSample] = useState(app.kyc?.sample || '');
  const [name, setName] = useState(app.kyc?.applicantName || app.contactName || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const kyc = app.kyc;
  const quote = app.quote;
  const noGstin = app.profile?.hasGstin === false;

  const sampleFiles = sample ? (meta?.samples?.find((s) => s.id === sample)?.files || []) : [];
  const preview = (type) => {
    if (files[type]) return URL.createObjectURL(files[type]);
    const f = sampleFiles.find((x) => x.includes(type.split('_')[0] === 'gst' ? 'gst_' : type.split('_')[0]));
    return f ? `/api/samples/${f}` : null;
  };
  const hasAny = Object.keys(files).length > 0 || sample;

  const check = async () => {
    setBusy(true); setErr('');
    try {
      let out;
      if (Object.keys(files).length) {
        const fd = new FormData();
        Object.entries(files).forEach(([type, f]) => { fd.append('files', f); fd.append('types', type); });
        if (name) fd.append('applicantName', name);
        out = await api.form(`/applications/${app.id}/kyc`, fd);
      } else {
        out = await api.post(`/applications/${app.id}/kyc`, { sample, applicantName: name || undefined });
      }
      patch({ kyc: out.kyc, quote: out.quote, profile: out.profile });
      if (!name && out.kyc.applicantName) setName(out.kyc.applicantName);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const removeUnavailable = async () => {
    const bad = new Set(quote.issues.map((i) => i.productId));
    const lines = app.selection.lines.filter((l) => !bad.has(l.productId));
    const out = await api.put(`/applications/${app.id}/selection`, { lines, term: app.selection.term });
    patch({ selection: out.selection, quote: out.quote });
  };
  const withdraw = async () => {
    await api.post(`/applications/${app.id}/consent/withdraw`);
    setFiles({}); setSample('');
    await reload();
  };
  const goNext = async () => {
    await api.put(`/applications/${app.id}/selection`, { lines: app.selection.lines, term: app.selection.term, stage: 'checkout' });
    patch({ stage: 'checkout' });
    onNext();
  };

  const statusMeta = {
    verified: { Icon: CheckCircle2, cls: 'border-ok-line bg-ok-bg text-ok', title: t('k_verified') },
    needs_attention: { Icon: XCircle, cls: 'border-bad-line bg-bad-bg text-bad', title: t('k_attention') },
    incomplete: { Icon: AlertCircle, cls: 'border-warn-line bg-warn-bg text-warn', title: t('k_incomplete') },
  };
  const sm = kyc && statusMeta[kyc.status];
  const fails = kyc?.checks?.filter((c) => c.status === 'fail') || [];
  const passed = kyc?.checks?.filter((c) => c.status === 'pass').length || 0;

  return (
    <div className="flex-1 mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-6 lg:py-8 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">
      <div className="min-w-0 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <h1 className="text-[26px] sm:text-[28px] font-extrabold tracking-[-0.03em]">{t('v_title')}</h1>
            <p className="mt-1.5 text-ink-3 max-w-[560px]">{t('v_sub')}</p>
          </div>
        </header>

        {/* Demo helper — clearly separated from the real flow */}
        <div className="rounded-xl border border-dashed border-line bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><FlaskConical size={15} className="text-ink-4" />{t('d_sample')}</span>
          <select value={sample} onChange={(e) => { setSample(e.target.value); setFiles({}); setName(''); }} className="field h-9 sm:w-56 text-[13px]" aria-label="Sample applicant">
            <option value="">Choose applicant…</option>
            {meta?.samples?.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.files.length} documents</option>)}
          </select>
          <span className="text-2xs text-ink-4 sm:ml-auto">Synthetic specimens from the hackathon pack</span>
        </div>

        {/* Result banner */}
        {kyc && sm && !busy && (
          <div className={cx('rounded-xl border px-4 sm:px-5 py-4 flex gap-3 animate-rise', sm.cls)}>
            <sm.Icon size={22} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-[15px]">{sm.title}</p>
              <p className="text-[13px] text-ink-2 mt-0.5">
                {passed} checks passed{fails.length ? ` · ${fails.length} to fix` : ''}{kyc.missing?.length ? ` · missing: ${kyc.missing.map((m) => m.label).join(', ')}` : ''}.
                {kyc.facts?.tradeName && <> Business: <b className="font-semibold">{kyc.facts.tradeName}</b>{kyc.facts.gstinMasked && <> · GSTIN <span className="num">{kyc.facts.gstinMasked}</span></>}</>}
              </p>
            </div>
          </div>
        )}

        {/* Document slots / results */}
        <div className="grid md:grid-cols-2 gap-4">
          {DOCS.map((d) => {
            const required = d.type === 'udyam_certificate' ? noGstin : d.type === 'gst_certificate' ? !noGstin : true;
            const checks = kyc?.checks?.filter((c) => c.doc === d.type) || [];
            const status = kyc?.docStatus?.[d.type];
            const src = preview(d.type);
            const read = kyc?.documents?.find((x) => x.type === d.type);
            return (
              <DocCard key={d.type} d={d} required={required} src={src} busy={busy} status={busy ? null : status} checks={busy ? [] : checks} read={busy ? null : read}
                onFile={(f) => { setFiles((x) => ({ ...x, [d.type]: f })); setSample(''); }} />
            );
          })}
        </div>

        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="applicant">{t('d_name')}</label>
            <input id="applicant" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neha Kaur" autoComplete="name" />
          </div>
          <button className="btn btn-dark btn-lg" onClick={check} disabled={!hasAny || busy}>
            {busy ? <><Spinner />{t('d_checking')}</> : kyc ? <><RotateCcw size={16} />Check again</> : <>{t('d_verify')}</>}
          </button>
        </div>
        {err && <ErrorNote>{err}</ErrorNote>}
        <p className="flex items-start gap-2 text-2xs text-ink-4 leading-relaxed">
          <Database size={13} className="mt-px shrink-0" />
          GSTIN and Udyam checks in this prototype use the mock registries supplied with the hackathon data — not live GSTN or Udyam systems. OCR runs on our server; images are never stored.
        </p>
      </div>

      {/* Side: what happens next + bundle impact */}
      <aside className="lg:sticky lg:top-[88px] space-y-4">
        {quote && !quote.valid && quote.issues?.length > 0 && (
          <div className="card p-5 border-warn-line">
            <p className="font-semibold text-[14px]">Your bundle needs an update</p>
            <ul className="mt-2 space-y-1.5">
              {quote.issues.map((i) => <li key={i.productId} className="text-[13px] text-ink-3"><span className="font-medium text-ink-2">{product(i.productId)?.name}</span> — {i.fails.map((f) => failText(f, product)).join(', ')}</li>)}
            </ul>
            <button className="btn btn-secondary btn-sm mt-3" onClick={removeUnavailable}>Remove these and re-price</button>
          </div>
        )}
        <div className="card p-5">
          <p className="font-semibold text-[14px]">What we check</p>
          <ol className="mt-3 space-y-3">
            {[['Read', 'Text is read from each photo automatically'], ['Validate', 'GSTIN format & check digit, dates, expiry'], ['Match', 'Against GST & Udyam registries (mock)'], ['Cross-check', 'Same business, name and address across documents']].map(([a, b], i) => (
              <li key={a} className="flex gap-3">
                <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-canvas border border-line text-2xs font-semibold text-ink-3">{i + 1}</span>
                <span className="text-[13px]"><b className="font-semibold">{a}.</b> <span className="text-ink-3">{b}</span></span>
              </li>
            ))}
          </ol>
          {kyc?.status === 'verified' && !busy ? (
            <button className="btn btn-primary btn-lg w-full mt-5" disabled={!quote?.valid} onClick={goNext}>{t('v_continue')}<ArrowRight size={17} /></button>
          ) : (
            <button className="btn btn-dark btn-lg w-full mt-5" onClick={check} disabled={!hasAny || busy}>
              {busy ? <><Spinner />{t('d_checking')}</> : kyc ? <><RotateCcw size={16} />Check again</> : t('d_verify')}
            </button>
          )}
          {!hasAny && !kyc && <p className="mt-2 text-2xs text-ink-4 text-center">Add your documents to start.</p>}
          {kyc && kyc.status !== 'verified' && !busy && <p className="mt-2 text-2xs text-ink-4 text-center">Fix the items marked in red, then check again.</p>}
        </div>
        <button onClick={withdraw} className="w-full text-2xs text-ink-4 hover:text-bad inline-flex items-center justify-center gap-1.5"><Trash2 size={12} />Withdraw consent & delete verification data</button>
      </aside>
    </div>
  );
}

function DocCard({ d, required, src, busy, status, checks, read, onFile }) {
  const { t } = useApp();
  const inputRef = useRef(null);
  const border = status === 'fail' ? 'border-bad-line' : status === 'warn' ? 'border-warn-line' : status === 'pass' ? 'border-ok-line' : 'border-line';
  return (
    <div className={cx('card overflow-hidden flex flex-col', border)}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <d.Icon size={17} className="text-ink-3 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate">{d.short}</p>
          <p className="text-2xs text-ink-4 truncate">{d.hint}</p>
        </div>
        {status ? <DocStatus status={status} /> : <span className={cx('pill', required ? 'pill-neutral' : 'pill-neutral opacity-70')}>{required ? t('d_required') : t('d_optional')}</span>}
      </div>

      <button type="button" onClick={() => inputRef.current?.click()} className="relative h-36 bg-canvas group overflow-hidden" aria-label={`${t('d_upload')}: ${d.short}`}>
        {src ? (
          <>
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
            {busy && <span className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-brand-600/15 to-transparent animate-scan" />}
            <span className="absolute bottom-2 right-2 btn btn-secondary btn-sm opacity-0 group-hover:opacity-100 transition-opacity"><RotateCcw size={13} />{t('d_replace')}</span>
          </>
        ) : (
          <span className="absolute inset-3 rounded-lg border border-dashed border-line grid place-items-center text-ink-3 group-hover:border-ink-4 group-hover:text-ink transition-colors">
            <span className="flex flex-col items-center gap-1.5 text-[13px] font-medium"><Upload size={18} />{t('d_upload')}</span>
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />

      {checks.length > 0 && (
        <ul className="px-4 py-3 space-y-2.5 border-t border-line animate-rise">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <span className="mt-0.5"><StatusIcon status={c.status} size="sm" /></span>
              <span className="min-w-0">
                <span className={cx('block text-[13px] font-semibold', c.status === 'fail' && 'text-bad')}>{c.label}</span>
                <span className="block text-[12px] text-ink-3 leading-snug break-words">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {read && Object.values(read.fields || {}).some(Boolean) && (
        <details className="group border-t border-line">
          <summary className="list-none cursor-pointer px-4 py-2.5 text-2xs font-semibold text-ink-3 flex items-center gap-1.5 hover:text-ink">
            What we read <span className="text-ink-4 font-medium">· OCR {read.confidence}%</span><ChevronDown size={13} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <dl className="px-4 pb-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[12px]">
            {Object.entries(read.fields).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-ink-4 capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd className="text-ink-2 break-words">{v}</dd></div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

function DocStatus({ status }) {
  if (status === 'pass') return <span className="pill pill-ok"><CheckCircle2 size={12} />Verified</span>;
  if (status === 'warn') return <span className="pill pill-warn"><AlertCircle size={12} />Review</span>;
  return <span className="pill pill-bad"><XCircle size={12} />Fix needed</span>;
}
