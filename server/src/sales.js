// Sales & partner worklist: historical dropped leads + digital journeys the advisor could not close.
import { leads, leadById, SEGMENT_KEY } from './data.js';
import { analytics, scoreLead, routeFor, REASONS } from './analytics.js';
import { all, get, run } from './db.js';
import { generate, llmEnabled } from './llm.js';
import { priceQuote } from './engine/pricing.js';

export const FOLLOWUP_STATUSES = ['New', 'Contacted', 'Call back', 'Won back', 'Not interested'];

let scored = null;
function scoreAll() {
  if (scored) return scored;
  const dropped = leads.filter((l) => l.outcome !== 'Activated');
  const raw = dropped.map((l) => ({ l, ...scoreLead(l) })).sort((a, b) => a.raw - b.raw);
  const segBundle = Object.fromEntries(analytics().segments.map((s) => [s.name, s.medianBundle]));
  scored = raw.map((x, i) => {
    const score = Math.round(((i + 1) / raw.length) * 100);
    return {
      id: x.l.lead_id,
      kind: 'historical',
      businessName: x.l.business_name,
      businessType: x.l.business_type,
      segment: x.l.segment,
      segmentKey: SEGMENT_KEY[x.l.segment],
      city: x.l.city,
      tier: x.l.city_tier,
      language: x.l.preferred_language,
      source: x.l.lead_source,
      stage: x.l.stage_reached,
      reason: x.l.drop_reason,
      reasonKind: REASONS[x.l.drop_reason]?.kind || 'market',
      createdDate: x.l.created_date,
      employees: x.l.employee_count,
      sites: x.l.num_sites,
      hasGstin: x.l.has_gstin === 'Y',
      contactName: x.l.contact_name,
      contactRole: x.l.contact_role,
      score,
      priority: score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low',
      expectedMonthly: segBundle[x.l.segment] || null,
      route: routeFor(x.l),
      play: REASONS[x.l.drop_reason]?.play || 'Follow up with the saved digital quote.',
      channel: REASONS[x.l.drop_reason]?.channel || 'Inside sales call',
      drivers: x.parts,
    };
  }).sort((a, b) => b.score - a.score);
  return scored;
}

// Digital journeys that stalled — the "leads the advisor could not close".
export function digitalLeads() {
  const rows = all('SELECT * FROM applications WHERE order_id IS NULL ORDER BY updated_at DESC LIMIT 200');
  return rows.map((a) => {
    const p = JSON.parse(a.profile_json || '{}');
    const kyc = a.kyc_json ? JSON.parse(a.kyc_json) : null;
    const firstFail = kyc?.checks?.find((c) => c.status === 'fail');
    const stageName = { advisor: 'Advisor chat', quote: 'Quote', kyc: 'KYC', checkout: 'Checkout' }[a.stage] || a.stage;
    const reason = firstFail ? `KYC: ${firstFail.label.toLowerCase()} failed`
      : a.stage === 'advisor' ? 'Left the advisor before a recommendation'
      : a.stage === 'quote' ? 'Saw the price but did not continue'
      : a.stage === 'kyc' ? 'Started verification, did not finish' : 'Did not confirm the order';
    const score = { advisor: 45, quote: 70, kyc: firstFail ? 92 : 82, checkout: 95 }[a.stage] ?? 50;
    const fu = get('SELECT status, note FROM followups WHERE lead_id = ?', [a.id]);
    return {
      id: a.id,
      kind: 'digital',
      businessName: p.businessName || (p.businessType ? `${p.businessType}${p.city ? ' · ' + p.city : ''}` : 'Unnamed business'),
      businessType: p.businessType || '—',
      segment: Object.entries(SEGMENT_KEY).find(([, v]) => v === p.segment)?.[0] || '—',
      segmentKey: p.segment,
      city: p.city || '—',
      tier: p.tier,
      language: a.language,
      source: 'Digital advisor',
      stage: stageName,
      reason,
      reasonKind: 'friction',
      createdDate: a.created_at.slice(0, 10),
      updatedAt: a.updated_at,
      employees: p.employees,
      sites: p.sites,
      hasGstin: p.gstinStatus === 'Active',
      contactName: a.contact_name,
      expectedMonthly: a.selection_json ? priceQuote(JSON.parse(a.selection_json), p).monthly : null,
      score,
      priority: score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low',
      route: p.segment === 'multi' || p.segment === 'mfg' ? 'Field sales' : 'Inside sales',
      play: firstFail ? `Help fix: ${firstFail.detail}` : 'Call within the hour while intent is fresh; the saved bundle is ready to resume.',
      channel: 'Inside sales call',
      followup: fu?.status || 'New',
      followupNote: fu?.note || '',
    };
  });
}

export function listLeads({ q = '', segment, priority, stage, reasonKind, route, followup, source, page = 1, pageSize = 25 } = {}) {
  const fu = new Map(all('SELECT lead_id, status, note, updated_at FROM followups').map((r) => [r.lead_id, r]));
  let rows = [...digitalLeads(), ...scoreAll().map((l) => ({ ...l, followup: fu.get(l.id)?.status || 'New', followupNote: fu.get(l.id)?.note || '' }))];
  const ql = q.trim().toLowerCase();
  if (ql) rows = rows.filter((r) => `${r.id} ${r.businessName} ${r.businessType} ${r.city} ${r.contactName || ''}`.toLowerCase().includes(ql));
  if (segment) rows = rows.filter((r) => r.segmentKey === segment);
  if (priority) rows = rows.filter((r) => r.priority === priority);
  if (stage) rows = rows.filter((r) => r.stage === stage);
  if (reasonKind) rows = rows.filter((r) => r.reasonKind === reasonKind);
  if (route) rows = rows.filter((r) => r.route === route);
  if (followup) rows = rows.filter((r) => r.followup === followup);
  if (source) rows = rows.filter((r) => (source === 'digital' ? r.kind === 'digital' : r.kind === 'historical'));
  const total = rows.length;
  const summary = {
    total,
    high: rows.filter((r) => r.priority === 'High').length,
    friction: rows.filter((r) => r.reasonKind === 'friction').length,
    digital: rows.filter((r) => r.kind === 'digital').length,
    wonBack: rows.filter((r) => r.followup === 'Won back').length,
    pipelineMonthly: rows.filter((r) => r.priority === 'High').reduce((s, r) => s + (r.expectedMonthly || 0), 0),
  };
  const start = (Math.max(1, Number(page)) - 1) * pageSize;
  return { total, summary, page: Number(page), pageSize, rows: rows.slice(start, start + Number(pageSize)) };
}

export function getLead(id) {
  const digital = digitalLeads().find((d) => d.id === id);
  if (digital) return digital;
  const s = scoreAll().find((l) => l.id === id);
  if (!s) return null;
  const fu = get('SELECT status, note, updated_at FROM followups WHERE lead_id = ?', [id]);
  const l = leadById.get(id);
  return {
    ...s,
    followup: fu?.status || 'New',
    followupNote: fu?.note || '',
    followupUpdated: fu?.updated_at || null,
    interest: l.products_of_interest ? l.products_of_interest.split(';') : [],
    currentInternet: l.current_internet,
    currentProvider: l.current_provider,
    monthlySpend: l.monthly_telecom_spend_inr,
    turnover: l.annual_turnover_band,
    timeline: [
      ['Lead created', l.created_date], ['Contacted', l.contacted_date], ['Needs assessed', l.needs_assessed_date],
      ['Quote accepted', l.quote_accepted_date], ['KYC complete', l.kyc_complete_date],
    ].filter(([, d]) => d).map(([label, date]) => ({ label, date })),
  };
}

export function setFollowup(id, status, note) {
  if (!FOLLOWUP_STATUSES.includes(status)) throw new Error('Invalid status');
  run(`INSERT INTO followups (lead_id, status, note, updated_at) VALUES (?,?,?,?)
       ON CONFLICT(lead_id) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at`,
  [id, status, (note || '').slice(0, 500), new Date().toISOString()]);
  return { id, status, note };
}

export async function suggestApproach(id) {
  const l = getLead(id);
  if (!l) return null;
  const fallback = {
    opener: openerTemplate(l),
    points: [
      l.play,
      `${l.segment === 'Micro retail & services' ? 'One clear monthly price, no visit needed' : 'One bill and one support number for everything'} — finish online in one sitting.`,
      l.hasGstin ? 'Their GSTIN lets us verify instantly and unlock WhatsApp Business & SMS.' : 'No GSTIN on file — offer products that do not need one; GST-only products can be added later.',
    ],
    channel: l.channel,
    source: 'rules',
  };
  if (!llmEnabled()) return fallback;
  const out = await generate({
    system: `You coach a telecom B2B salesperson re-engaging an Indian small business that dropped out. Be specific, respectful, brief.
Return JSON: {"opener": "a 2-sentence WhatsApp/call opener in ${l.language || 'English'} (use the contact's first name)", "points": ["3 short talking points in English"]}.
Do not invent prices, discounts or products. Base it on the recommended play.`,
    prompt: JSON.stringify({
      business: l.businessName, type: l.businessType, segment: l.segment, city: l.city, contact: l.contactName, role: l.contactRole,
      stage_reached: l.stage, drop_reason: l.reason, recommended_play: l.play, has_gstin: l.hasGstin, employees: l.employees, sites: l.sites,
    }),
    json: true,
    temperature: 0.5,
  });
  if (!out?.opener) return fallback;
  return { opener: out.opener, points: Array.isArray(out.points) ? out.points.slice(0, 3) : fallback.points, channel: l.channel, source: 'llm' };
}

function openerTemplate(l) {
  const first = (l.contactName || '').split(' ')[0] || 'there';
  const hi = l.language === 'Hindi';
  const byReason = {
    'Quote too complex to understand': hi ? 'हमने आपके लिए एक आसान कोटेशन बनाया है — एक मासिक कीमत, बाक़ी सब आप ख़ुद चुन सकते हैं।' : 'we have made your quote simpler — one monthly price, and you can switch extras on or off yourself.',
    'Quote took too long to arrive': hi ? 'माफ़ कीजिए, पिछली बार कोटेशन में देर हुई। अब आप 3 मिनट में ख़ुद अपनी कीमत देख सकते हैं।' : 'sorry the quote took so long last time. You can now see your exact price yourself in about 3 minutes.',
    'Owner had no time for a visit': hi ? 'अब विज़िट की ज़रूरत नहीं — फ़ोन पर 3 मिनट में अपना प्लान और कीमत देखिए।' : 'no visit needed any more — you can see your plan and price on your phone in about 3 minutes, whenever suits you.',
    'Found paperwork too long': hi ? 'अब काग़ज़ी काम सिर्फ़ फ़ोटो अपलोड है — हम बाक़ी सब अपने आप जाँच लेते हैं।' : 'the paperwork is now just a few photos — we check everything else automatically.',
  };
  const body = byReason[l.reason] || (hi ? 'आपके व्यवसाय के लिए सुझाया गया प्लान अब ऑनलाइन तैयार है।' : 'the plan we suggested for your business is ready online whenever you are.');
  return hi ? `नमस्ते ${first} जी, Accel Business से। ${body}` : `Hi ${first}, this is Accel Business — ${body}`;
}
