export const inr = (n, opts = {}) =>
  n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN', opts);
export const pct = (x, d = 1) => (x == null ? '—' : (x * 100).toFixed(d).replace(/\.0$/, '') + '%');
export const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  s ? new Date(s.length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('en-IN', opts) : '—';
export const fmtTime = (s) => (s ? new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const cx = (...a) => a.filter(Boolean).join(' ');
