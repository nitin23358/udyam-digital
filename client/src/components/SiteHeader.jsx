import { Link, NavLink } from 'react-router-dom';
import { Languages, PackageSearch, LayoutDashboard } from 'lucide-react';
import { Logo } from './ui.jsx';
import { useApp } from '../lib/app.jsx';
import { cx } from '../lib/format.js';

export default function SiteHeader({ right }) {
  const { t, lang, setLang, meta } = useApp();
  const langs = meta?.languages?.filter((l) => l.available) || [{ code: 'en', native: 'English' }, { code: 'hi', native: 'हिन्दी' }];
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-line">
      <div className="mx-auto max-w-[1200px] h-16 px-4 sm:px-6 flex items-center gap-4">
        <Link to="/" aria-label="Home"><Logo /></Link>
        <div className="flex-1" />
        {right}
        <label className="relative hidden sm:flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
          <Languages size={16} />
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="appearance-none bg-transparent pr-1 font-medium cursor-pointer focus:outline-none" aria-label="Language">
            {langs.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
          </select>
        </label>
        <NavLink to="/track" className={({ isActive }) => cx('btn btn-ghost btn-sm', isActive && 'text-ink bg-canvas')}>
          <PackageSearch size={16} /><span className="hidden sm:inline">{t('nav_track')}</span>
        </NavLink>
        <Link to="/console" className="btn btn-secondary btn-sm"><LayoutDashboard size={15} /><span className="hidden md:inline">{t('nav_console')}</span></Link>
      </div>
    </header>
  );
}
