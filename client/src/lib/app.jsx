import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { makeT } from './i18n.js';

const Ctx = createContext(null);
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function AppProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [lang, setLangState] = useState(() => store.get('ud.lang', 'en'));
  useEffect(() => { api.get('/meta').then(setMeta).catch(() => setMeta({ error: true })); }, []);
  const setLang = (l) => { setLangState(l); store.set('ud.lang', l); };
  const value = useMemo(() => ({
    meta, lang, setLang, t: makeT(lang),
    lastApp: store.get('ud.lastApp', null), setLastApp: (id) => store.set('ud.lastApp', id),
    productName: (id) => meta?.catalogue?.find((p) => p.id === id)?.name || id,
    product: (id) => meta?.catalogue?.find((p) => p.id === id),
  }), [meta, lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useApp = () => useContext(Ctx);
