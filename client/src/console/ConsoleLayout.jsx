import { NavLink, Outlet, Link } from 'react-router-dom';
import { LineChart, ListTodo, PackageCheck, ArrowUpRight, Sparkles } from 'lucide-react';
import { Logo } from '../components/ui.jsx';
import { useApp } from '../lib/app.jsx';
import { cx } from '../lib/format.js';

const NAV = [
  ['/console', 'Insights', LineChart, true],
  ['/console/leads', 'Worklist', ListTodo],
  ['/console/orders', 'Digital orders', PackageCheck],
];

export default function ConsoleLayout() {
  const { meta } = useApp();
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden lg:flex flex-col bg-console-bg text-console-text sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-console-line"><Logo dark /></div>
        <p className="px-5 pt-5 pb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-console-text/45">Growth console</p>
        <nav className="px-3 space-y-0.5">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] font-medium transition-colors',
              isActive ? 'bg-white/[.08] text-white' : 'text-console-text/75 hover:text-white hover:bg-white/[.04]')}>
              {({ isActive }) => (<><Icon size={16} className={isActive ? 'text-brand-500' : ''} />{label}</>)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-4 space-y-3">
          <div className="rounded-lg border border-console-line bg-console-panel px-3 py-2.5 text-2xs leading-relaxed">
            <p className="flex items-center gap-1.5 font-semibold text-white"><Sparkles size={12} className="text-brand-500" />AI {meta?.llm?.enabled ? 'on' : 'fallback'}</p>
            <p className="text-console-text/60 mt-0.5">{meta?.llm?.enabled ? meta.llm.model : 'Rule-based suggestions (no API key)'}</p>
          </div>
          <Link to="/" className="flex items-center justify-between h-9 px-3 rounded-lg text-[13px] text-console-text/75 hover:text-white hover:bg-white/[.04]">
            Customer site <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-console-bg text-white">
        <div className="h-14 px-4 flex items-center justify-between"><Logo dark /><Link to="/" className="text-[12px] text-console-text">Customer site</Link></div>
        <nav className="flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-none">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('shrink-0 flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-medium', isActive ? 'bg-white/10 text-white' : 'text-console-text/70')}>
              <Icon size={14} />{label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="min-w-0"><Outlet /></main>
    </div>
  );
}

export function PageHead({ title, sub, right }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[22px] sm:text-[24px] font-extrabold tracking-[-0.025em]">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-ink-3">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
