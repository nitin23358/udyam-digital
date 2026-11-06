import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck, ArrowUpRight, ChevronsRight } from 'lucide-react';
import { PageHead } from './ConsoleLayout.jsx';
import { Spinner, Empty } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { inr, fmtDate, cx } from '../lib/format.js';

const STATUS = { placed: 'Placed', kyc_verified: 'Verified', install_scheduled: 'Install scheduled', activated: 'Activated' };

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState('');
  const load = () => api.get('/orders').then(setOrders);
  useEffect(() => { load(); }, []);
  const advance = async (id) => { setBusy(id); await api.post(`/orders/${id}/advance`); await load(); setBusy(''); };

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1320px]">
      <PageHead title="Digital orders" sub="Orders placed through the self-serve journey. Mark installs complete to update the customer's tracker." />
      <section className="card overflow-hidden">
        {!orders ? <div className="grid place-items-center py-16"><Spinner className="text-ink-4" /></div> : !orders.length ? (
          <Empty icon={PackageCheck} title="No digital orders yet" body="Complete a journey on the customer site and it will appear here instantly." action={<Link to="/" className="btn btn-primary btn-sm">Open customer site</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="c-table w-full text-[13px] min-w-[820px]">
              <thead><tr><th>Order</th><th>Business</th><th>Install slot</th><th className="text-right">Monthly</th><th>Status</th><th /></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const done = o.status === 'activated';
                  return (
                    <tr key={o.id} className="hover:bg-canvas/60">
                      <td><Link to={`/track/${o.id}`} className="num font-semibold inline-flex items-center gap-1 hover:text-brand-700">{o.id}<ArrowUpRight size={13} /></Link><p className="text-2xs text-ink-4">{fmtDate(o.createdAt)}</p></td>
                      <td><p className="font-medium">{o.businessName}</p><p className="text-2xs text-ink-4">{o.quote.lines?.length} products · {o.city || '—'}</p></td>
                      <td className="num text-ink-2">{o.installSlot}</td>
                      <td className="text-right num font-semibold">{inr(o.quote.monthly)}</td>
                      <td><span className={cx('pill', done ? 'pill-ok' : 'pill-neutral')}>{STATUS[o.status] || o.status}</span></td>
                      <td className="text-right">
                        {!done && <button className="btn btn-secondary btn-sm" onClick={() => advance(o.id)} disabled={busy === o.id}>{busy === o.id ? <Spinner size={13} /> : <ChevronsRight size={14} />}Mark installed</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
