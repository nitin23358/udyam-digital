import { Check, Minus, Plus, X, AlertTriangle, Loader2 } from 'lucide-react';
import { cx } from '../lib/format.js';

export function Logo({ dark = false, compact = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="#E40000" />
        <path d="M9 22c3-9 11-12 14-8" stroke="white" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="22.5" cy="21" r="2.2" fill="white" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className={cx('block text-[15px] font-extrabold tracking-[-0.02em]', dark ? 'text-white' : 'text-ink')}>Accel Business</span>
          <span className={cx('block text-2xs font-medium mt-0.5', dark ? 'text-console-text/70' : 'text-ink-4')}>Udyam Digital</span>
        </span>
      )}
    </span>
  );
}

export function Toggle({ on, onChange, label, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx('relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        on ? 'bg-ink' : 'bg-line hover:bg-[#dcdce3]')}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 200, label }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-white h-8" aria-label={label}>
      <button type="button" className="h-8 w-8 grid place-items-center text-ink-3 hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease"><Minus size={14} /></button>
      <span className="num w-7 text-center text-[13px] font-semibold">{value}</span>
      <button type="button" className="h-8 w-8 grid place-items-center text-ink-3 hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase"><Plus size={14} /></button>
    </div>
  );
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div className="inline-flex rounded-[10px] bg-canvas border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)} disabled={o.disabled}
          className={cx('rounded-lg font-semibold transition-all disabled:opacity-40', size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3.5 text-[13px]',
            value === o.value ? 'bg-white text-ink shadow-card border border-line' : 'text-ink-3 hover:text-ink border border-transparent')}
        >{o.label}</button>
      ))}
    </div>
  );
}

const STATUS = {
  pass: { cls: 'pill-ok', Icon: Check },
  ok: { cls: 'pill-ok', Icon: Check },
  warn: { cls: 'pill-warn', Icon: AlertTriangle },
  fail: { cls: 'pill-bad', Icon: X },
};
export function StatusIcon({ status, size = 'md' }) {
  const s = STATUS[status] || STATUS.warn;
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const tone = status === 'fail' ? 'bg-bad text-white' : status === 'warn' ? 'bg-warn text-white' : 'bg-ok text-white';
  return <span className={cx('grid place-items-center rounded-full shrink-0', dim, tone)}><s.Icon size={size === 'sm' ? 10 : 12} strokeWidth={3} /></span>;
}

export function TypingDots({ label }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-4 text-[13px]" role="status">
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-4 animate-dot" style={{ animationDelay: `${i * 0.18}s` }} />)}
      </span>
      {label}
    </span>
  );
}

export const Spinner = ({ size = 16, className }) => <Loader2 size={size} className={cx('animate-spin', className)} />;

export function Empty({ icon: Icon, title, body, action }) {
  return (
    <div className="text-center py-14 px-6">
      {Icon && <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-canvas border border-line text-ink-3"><Icon size={20} /></span>}
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-ink-3 text-[13px] max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div className="flex items-start gap-2 rounded-lg border border-bad-line bg-bad-bg px-3 py-2.5 text-[13px] text-bad"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{children}</span></div>;
}
