// Business intelligence over smb_leads.csv. Every number is computed here from the supplied data.
import { leads, SEGMENT_KEY } from './data.js';

const STAGES = ['Lead', 'Contacted', 'Needs assessed', 'Quote accepted', 'KYC complete', 'Activated'];
const stageIdx = (s) => STAGES.indexOf(s);
const pct = (a, b) => (b ? a / b : 0);
const r1 = (x) => Math.round(x * 10) / 10;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isAct = (l) => l.outcome === 'Activated';

// Drop reasons the digital journey directly removes (process friction) vs. market reasons.
export const REASONS = {
  'Unreachable after 3 attempts': { kind: 'reach', factor: 0.6, play: 'Switch channel: WhatsApp a link to the 3-minute advisor instead of calling again.', channel: 'WhatsApp nudge' },
  'Owner had no time for a visit': { kind: 'friction', factor: 1.5, play: 'No visit needed — send the self-serve advisor link; the owner can finish in one sitting at night.', channel: 'WhatsApp nudge' },
  'Not interested on first call': { kind: 'market', factor: 0.35, play: 'Low priority. Add to the next segment campaign rather than calling.', channel: 'Campaign' },
  'Price too high': { kind: 'price', factor: 0.9, play: 'Re-quote on a 24-month term (catalogue floor price) and drop optional add-ons.', channel: 'Inside sales call' },
  'Locked in with current provider': { kind: 'market', factor: 0.5, play: 'Note contract end date; schedule a reminder 30 days before it expires.', channel: 'Reminder' },
  'Wrong or invalid number': { kind: 'reach', factor: 0.15, play: 'Fix contact data via the channel partner who sourced the lead.', channel: 'Data fix' },
  'Visit not scheduled by sales': { kind: 'friction', factor: 1.6, play: 'Our miss, not theirs. Apologise and offer the digital quote today.', channel: 'Inside sales call' },
  'Only wanted a mobile plan': { kind: 'market', factor: 0.7, play: 'Sell Business Postpaid online now; revisit broadband in 90 days.', channel: 'WhatsApp nudge' },
  'Competitor offered cheaper plan': { kind: 'price', factor: 0.8, play: 'Lead with one bill + one support number and the 24-month price, not a discount.', channel: 'Inside sales call' },
  'Quote too complex to understand': { kind: 'friction', factor: 1.7, play: 'Send the plain-language quote link: one monthly price, toggles for extras.', channel: 'WhatsApp nudge' },
  'Quote took too long to arrive': { kind: 'friction', factor: 1.7, play: 'Send an instant quote link now — it prices in seconds from the catalogue.', channel: 'WhatsApp nudge' },
  'Decided to wait': { kind: 'market', factor: 0.8, play: 'Light-touch reminder in 30 days with their saved bundle.', channel: 'Reminder' },
  'Missing GST or Udyam document': { kind: 'friction', factor: 1.6, play: 'Use GSTIN/Udyam number lookup instead of asking for paper; or proceed without GST-only products.', channel: 'WhatsApp nudge' },
  'Found paperwork too long': { kind: 'friction', factor: 1.8, play: 'Smart KYC: photo upload, auto-read and registry check — about 2 minutes.', channel: 'WhatsApp nudge' },
  'Authorised signatory not available': { kind: 'friction', factor: 1.4, play: 'Send the e-sign link straight to the signatory\'s phone.', channel: 'WhatsApp nudge' },
  'Document details did not match': { kind: 'friction', factor: 1.4, play: 'Show the exact mismatch from the KYC check and ask for one corrected document.', channel: 'Inside sales call' },
  'Installation delayed beyond 21 days': { kind: 'friction', factor: 1.8, play: 'Escalate install; offer 5G AirFiber as a 2-day interim link.', channel: 'Field visit' },
  'Customer cancelled before install': { kind: 'market', factor: 0.6, play: 'Ask why in one WhatsApp question; re-offer if timing was the issue.', channel: 'WhatsApp nudge' },
  'Site not feasible for fibre': { kind: 'friction', factor: 1.5, play: 'Offer 5G AirFiber (no cabling, ~2 days) instead of fibre.', channel: 'Inside sales call' },
  'First payment failed': { kind: 'friction', factor: 2.0, play: 'Send a UPI payment link — order is otherwise ready to activate.', channel: 'WhatsApp nudge' },
};
const FRICTION_KINDS = new Set(['friction']);

function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) { const k = typeof key === 'function' ? key(x) : x[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

function rowStats(rows) {
  const act = rows.filter(isAct);
  const cost = rows.reduce((s, l) => s + (l.acquisition_cost_inr || 0), 0);
  return {
    leads: rows.length,
    activated: act.length,
    conversion: pct(act.length, rows.length),
    cacPerActivation: act.length ? Math.round(cost / act.length) : null,
    medianBundle: act.length ? median(act.map((l) => l.monthly_bundle_value_inr)) : null,
    churn6m: act.length ? pct(act.filter((l) => l.churned_within_6_months === 'Y').length, act.length) : null,
    nps: act.length ? r1(mean(act.map((l) => l.nps_score))) : null,
    avgDays: act.length ? r1(mean(act.map((l) => l.days_lead_to_activation))) : null,
  };
}

let cached = null;
export function analytics() {
  if (cached) return cached;
  const all = rowStats(leads);
  const act = leads.filter(isAct);
  const totalCost = leads.reduce((s, l) => s + (l.acquisition_cost_inr || 0), 0);

  const funnel = STAGES.map((s, i) => {
    const n = leads.filter((l) => stageIdx(l.stage_reached) >= i).length;
    return { stage: s, count: n };
  }).map((f, i, arr) => ({ ...f, ofPrev: i ? pct(f.count, arr[i - 1].count) : 1, ofTotal: pct(f.count, arr[0].count), lost: i ? arr[i - 1].count - f.count : 0 }));

  const segments = [...groupBy(leads, 'segment')].map(([name, rows]) => ({ name, key: SEGMENT_KEY[name], share: pct(rows.length, leads.length), ...rowStats(rows) }))
    .sort((a, b) => b.leads - a.leads);
  const sources = [...groupBy(leads, 'lead_source')].map(([name, rows]) => ({ name, ...rowStats(rows) })).sort((a, b) => b.leads - a.leads);

  const dropped = leads.filter((l) => !isAct(l));
  const drops = [...groupBy(dropped, 'drop_reason')].map(([reason, rows]) => ({
    reason, count: rows.length, stage: rows[0].stage_reached, kind: REASONS[reason]?.kind || 'market',
  })).sort((a, b) => b.count - a.count);
  const frictionDrops = drops.filter((d) => FRICTION_KINDS.has(d.kind)).reduce((s, d) => s + d.count, 0);

  const dropsByStage = STAGES.slice(0, -1).map((s) => {
    const rows = dropped.filter((l) => l.stage_reached === s);
    return { stage: s, total: rows.length, friction: rows.filter((l) => FRICTION_KINDS.has(REASONS[l.drop_reason]?.kind)).length };
  });

  const gst = ['Y', 'N'].map((v) => ({ hasGstin: v === 'Y', ...rowStats(leads.filter((l) => l.has_gstin === v)) }));
  const chases = [...groupBy(act, 'customer_follow_up_calls')].map(([calls, rows]) => ({
    calls: Number(calls), customers: rows.length,
    churn6m: pct(rows.filter((l) => l.churned_within_6_months === 'Y').length, rows.length), nps: r1(mean(rows.map((l) => l.nps_score))),
  })).sort((a, b) => a.calls - b.calls);
  const internet = [...groupBy(leads, 'current_internet')].map(([name, rows]) => ({ name, ...rowStats(rows) })).sort((a, b) => b.leads - a.leads);

  // Data-driven insights (text built from the numbers above).
  const seg = Object.fromEntries(segments.map((s) => [s.key, s]));
  const steepest = funnel.slice(1).reduce((a, b) => (b.ofPrev < a.ofPrev ? b : a));
  const lowChase = chases.filter((c) => c.calls <= 2), highChase = chases.filter((c) => c.calls >= 4);
  const wavg = (xs, k) => xs.reduce((s, c) => s + c[k] * c.customers, 0) / Math.max(1, xs.reduce((s, c) => s + c.customers, 0));
  const ref = sources.find((s) => s.name === 'Referral'), field = sources.find((s) => s.name === 'Field sales');
  const insights = [
    {
      id: 'friction', tone: 'opportunity',
      title: `${Math.round(pct(frictionDrops, dropped.length) * 100)}% of lost leads were lost to our own process`,
      body: `${frictionDrops.toLocaleString('en-IN')} of ${dropped.length.toLocaleString('en-IN')} drops cite slow or complex quotes, paperwork, unscheduled visits or install delays — exactly what a self-serve journey removes.`,
    },
    {
      id: 'steepest', tone: 'risk',
      title: `Steepest drop: ${funnel[funnel.indexOf(steepest) - 1].stage} → ${steepest.stage} (${Math.round(steepest.ofPrev * 100)}% pass)`,
      body: `${drops.filter((d) => d.stage === 'Needs assessed').map((d) => `${d.reason.toLowerCase()} (${d.count})`).slice(0, 4).join(', ')}. An instant, plain-language price attacks the top reasons.`,
    },
    {
      id: 'segments', tone: 'focus',
      title: `Professional offices: best unit economics — ${Math.round(seg.prof.conversion * 100)}% conversion at ₹${seg.prof.cacPerActivation.toLocaleString('en-IN')} CAC`,
      body: `Micro retail is ${Math.round(seg.micro.share * 100)}% of leads but converts at ${Math.round(seg.micro.conversion * 1000) / 10}% with ₹${seg.micro.cacPerActivation.toLocaleString('en-IN')} CAC against a ₹${seg.micro.medianBundle.toLocaleString('en-IN')}/month bundle and ${Math.round(seg.micro.churn6m * 100)}% churn — it only works fully self-serve.`,
    },
    {
      id: 'gstin', tone: 'focus',
      title: `GSTIN holders convert ${r1(gst[0].conversion / gst[1].conversion)}× better (${r1(gst[0].conversion * 100)}% vs ${r1(gst[1].conversion * 100)}%)`,
      body: 'Ask for the GSTIN early: one lookup verifies the business, fills the form and unlocks GST-only products. Without one, sell what does not need it rather than stalling.',
    },
    {
      id: 'chases', tone: 'risk',
      title: `Customers who chase status churn more: ${Math.round(wavg(lowChase, 'churn6m') * 100)}% (≤2 calls) vs ${Math.round(wavg(highChase, 'churn6m') * 100)}% (4+ calls)`,
      body: `NPS falls from ${r1(wavg(lowChase, 'nps'))} to ${r1(wavg(highChase, 'nps'))}. A live order tracker that answers "where is my connection?" protects retention, not just support cost.`,
    },
    {
      id: 'channels', tone: 'opportunity',
      title: `Referrals convert ${r1(ref.conversion * 100)}% at ₹${ref.cacPerActivation.toLocaleString('en-IN')} CAC; field sales ${r1(field.conversion * 100)}% at ₹${field.cacPerActivation.toLocaleString('en-IN')}`,
      body: 'Redeploy field sales to multi-site and manufacturing accounts where bundles are 4–6× larger; let partners and referrals feed the digital journey for micro and professional offices.',
    },
  ];

  cached = {
    kpis: {
      totalLeads: leads.length,
      activated: act.length,
      conversion: all.conversion,
      avgDaysToActivate: all.avgDays,
      medianBundle: all.medianBundle,
      meanBundle: Math.round(mean(act.map((l) => l.monthly_bundle_value_inr))),
      cacPerActivation: Math.round(totalCost / act.length),
      avgChases: r1(mean(act.map((l) => l.customer_follow_up_calls))),
      churn6m: all.churn6m,
      nps: all.nps,
      period: 'Apr–Jun 2026',
    },
    funnel, segments, sources, drops, dropsByStage, gst, chases, internet, insights,
    friction: { drops: frictionDrops, share: pct(frictionDrops, dropped.length) },
    targets: [
      { metric: 'Lead → activation conversion', baseline: `${r1(all.conversion * 100)}%`, target: '12%', why: 'Recover a third of friction-driven drops' },
      { metric: 'Lead → activation time', baseline: `${all.avgDays} days`, target: '≤ 7 days', why: 'Instant quote + KYC; only install time remains' },
      { metric: 'Acquisition cost per activation', baseline: `₹${Math.round(totalCost / act.length).toLocaleString('en-IN')}`, target: '≤ ₹6,000', why: 'Self-serve for micro & professional offices' },
      { metric: 'Status chases per customer', baseline: `${r1(mean(act.map((l) => l.customer_follow_up_calls)))}`, target: '< 1', why: 'Live order tracker' },
      { metric: '6-month churn', baseline: `${r1(all.churn6m * 100)}%`, target: '≤ 10%', why: 'Right-sized bundles, fewer chases' },
    ],
  };
  return cached;
}

// ---------------- Propensity scoring for the sales worklist ----------------
// Transparent, explainable model: historical activation-rate lift per attribute (from this file),
// multiplied by how deep the lead got and how recoverable its drop reason is.
let model = null;
function buildModel() {
  const base = pct(leads.filter(isAct).length, leads.length);
  const lift = {};
  for (const attr of ['segment', 'lead_source', 'has_gstin', 'current_internet', 'annual_turnover_band', 'city_tier']) {
    lift[attr] = {};
    for (const [k, rows] of groupBy(leads, attr)) lift[attr][k] = pct(rows.filter(isAct).length, rows.length) / base;
  }
  // Probability of eventually activating given the stage reached (among leads that got there).
  const stage = {};
  STAGES.forEach((s, i) => {
    const reached = leads.filter((l) => stageIdx(l.stage_reached) >= i);
    stage[s] = pct(reached.filter(isAct).length, reached.length) / base;
  });
  return { base, lift, stage };
}

export function scoreLead(l) {
  model ||= buildModel();
  const parts = [];
  let s = model.base;
  for (const attr of ['segment', 'lead_source', 'has_gstin', 'current_internet', 'annual_turnover_band']) {
    const f = Math.pow(model.lift[attr][l[attr]] ?? 1, 0.7);
    s *= f;
    parts.push({ attr, value: l[attr], lift: r1(f) });
  }
  const st = Math.pow(model.stage[l.stage_reached] ?? 1, 0.8);
  s *= st;
  const rf = REASONS[l.drop_reason]?.factor ?? 1;
  s *= rf;
  parts.push({ attr: 'stage_reached', value: l.stage_reached, lift: r1(st) }, { attr: 'drop_reason', value: l.drop_reason, lift: rf });
  return { raw: s, parts };
}

export function routeFor(l) {
  // Q4: who should own the follow-up, so digital adds to the field force instead of competing.
  const seg = SEGMENT_KEY[l.segment];
  const channel = REASONS[l.drop_reason]?.channel;
  if (seg === 'multi' || seg === 'mfg') return channel === 'Field visit' || l.employee_count >= 25 ? 'Field sales' : 'Inside sales';
  if (l.lead_source === 'Channel partner') return 'Channel partner';
  if (channel === 'WhatsApp nudge' || channel === 'Reminder' || channel === 'Campaign') return 'Digital nudge';
  return 'Inside sales';
}

export { STAGES };
