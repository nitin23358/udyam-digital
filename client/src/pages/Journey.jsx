import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { Check, Bookmark } from 'lucide-react';
import SiteHeader from '../components/SiteHeader.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import Advisor from './journey/Advisor.jsx';
import Bundle from './journey/Bundle.jsx';
import Verify from './journey/Verify.jsx';
import Confirm from './journey/Confirm.jsx';
import { useApp } from '../lib/app.jsx';
import { api } from '../lib/api.js';
import { cx } from '../lib/format.js';

const STEPS = ['advisor', 'bundle', 'verify', 'confirm'];
const STEP_FOR_STAGE = { advisor: 'advisor', quote: 'bundle', kyc: 'verify', checkout: 'confirm' };

export default function Journey() {
  const { id, step: stepParam } = useParams();
  const { state } = useLocation();
  const nav = useNavigate();
  const { t, setLastApp, lang, setLang } = useApp();
  const [app, setApp] = useState(state?.fresh || null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try { setApp(await api.get(`/applications/${id}`)); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { setLastApp(id); if (!state?.fresh) reload(); }, [id]); // eslint-disable-line

  // Keep UI chrome in the language the advisor conversation is in.
  useEffect(() => { if (app?.language && app.language !== lang) setLang(app.language); }, [app?.language]); // eslint-disable-line

  if (error) return <Shell><Empty title="We couldn't open this application" body={error} action={<Link to="/" className="btn btn-primary">Start again</Link>} /></Shell>;
  if (!app) return <Shell><div className="grid place-items-center py-32"><Spinner size={22} className="text-ink-4" /></div></Shell>;
  if (app.orderId) { nav(`/track/${app.orderId}`, { replace: true }); return null; }

  const maxStep = STEPS.indexOf(STEP_FOR_STAGE[app.stage] || 'advisor');
  const step = STEPS.includes(stepParam) && STEPS.indexOf(stepParam) <= Math.max(maxStep, 0) ? stepParam : STEPS[Math.max(maxStep, 0)];
  const go = (s) => nav(`/apply/${id}/${s}`);
  const patch = (p) => setApp((a) => ({ ...a, ...p }));

  return (
    <Shell>
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 h-14 flex items-center gap-4">
          <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 flex-1">
            {STEPS.map((s, i) => {
              const done = i < maxStep;
              const reachable = i <= maxStep;
              const active = s === step;
              return (
                <li key={s} className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {i > 0 && <span className={cx('h-px w-4 sm:w-8', i <= maxStep ? 'bg-ink/30' : 'bg-line')} />}
                  <button type="button" disabled={!reachable} onClick={() => go(s)}
                    className={cx('flex items-center gap-2 rounded-full h-8 pl-1 pr-3 text-[13px] font-semibold transition-colors',
                      active ? 'bg-ink text-white' : reachable ? 'text-ink-2 hover:bg-canvas' : 'text-ink-4')}>
                    <span className={cx('grid h-6 w-6 place-items-center rounded-full text-2xs num',
                      active ? 'bg-white/15' : done ? 'bg-ok text-white' : reachable ? 'bg-canvas border border-line' : 'border border-line')}>
                      {done && !active ? <Check size={12} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={cx(!active && 'hidden sm:inline')}>{t('step_' + s)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <span className="hidden lg:inline-flex items-center gap-1.5 text-2xs text-ink-4" title={t('save_later')}><Bookmark size={13} />Saved · {id}</span>
        </div>
      </div>

      {step === 'advisor' && <Advisor app={app} patch={patch} onNext={() => go('bundle')} onRecommended={() => nav(`/apply/${id}/advisor`, { replace: true })} />}
      {step === 'bundle' && <Bundle app={app} patch={patch} onNext={() => go('verify')} />}
      {step === 'verify' && <Verify app={app} patch={patch} reload={reload} onNext={() => go('confirm')} onBack={() => go('bundle')} />}
      {step === 'confirm' && <Confirm app={app} onBack={() => go('verify')} onDone={(orderId) => nav(`/track/${orderId}`, { state: { fresh: true } })} />}
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen bg-canvas flex flex-col"><SiteHeader />{children}</div>;
}
