import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { initDb, run, get, all, audit } from './db.js';
import { catalogue, productById, cities, gstinRegistry, udyamRegistry, sampleApplicants, KYC_DIR, DATA_TODAY } from './data.js';
import { advisorStart, advisorTurn, questionFor, nextSlot } from './advisor/index.js';
import { LANGS } from './advisor/copy.js';
import { recommend, NEEDS } from './engine/recommend.js';
import { priceQuote } from './engine/pricing.js';
import { validateGstin, maskGstin } from './kyc/gstin.js';
import { runKyc, sampleFiles, sampleContext } from './kyc/index.js';
import { warmUp } from './kyc/ocr.js';
import { analytics } from './analytics.js';
import { listLeads, getLead, setFollowup, suggestApproach, FOLLOWUP_STATUSES } from './sales.js';
import { llmInfo, llmEnabled } from './llm.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Images stay in memory only — never written to disk (data minimisation).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 6 } });

const now = () => new Date().toISOString();
const newId = (prefix, n = 8) => prefix + crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, '').toUpperCase().slice(0, n);
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(500).json({ error: e.message || 'Something went wrong' });
});
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

function loadApp(id) {
  const a = get('SELECT * FROM applications WHERE id = ?', [id]);
  if (!a) return null;
  return {
    id: a.id, createdAt: a.created_at, updatedAt: a.updated_at, language: a.language, stage: a.stage,
    profile: parse(a.profile_json, {}), transcript: parse(a.transcript_json, []), selection: parse(a.selection_json, null),
    kyc: parse(a.kyc_json, null), contactName: a.contact_name, phoneMasked: a.phone_masked, orderId: a.order_id,
  };
}
function saveApp(a) {
  run(`UPDATE applications SET updated_at=?, language=?, stage=?, profile_json=?, transcript_json=?, selection_json=?, kyc_json=?, contact_name=?, phone_masked=?, order_id=? WHERE id=?`, [
    now(), a.language, a.stage, JSON.stringify(a.profile), JSON.stringify(a.transcript), a.selection ? JSON.stringify(a.selection) : null,
    a.kyc ? JSON.stringify(a.kyc) : null, a.contactName || null, a.phoneMasked || null, a.orderId || null, a.id,
  ]);
}
function publicApp(a) {
  const quote = a.selection ? priceQuote(a.selection, a.profile) : null;
  const rec = a.profile && a.stage !== 'advisor' ? recommend(a.profile, a.language === 'hi' ? 'hi' : 'en') : null;
  return { ...a, quote, recommendation: rec ? { ...rec, summary: a.selection?.summary, explainedBy: a.selection?.explainedBy } : null };
}

// ---------------- meta ----------------
app.get('/api/health', (req, res) => res.json({ ok: true, llm: llmInfo(), dataToday: DATA_TODAY }));
app.get('/api/meta', (req, res) => res.json({
  llm: llmInfo(),
  languages: Object.entries(LANGS).map(([code, l]) => ({ code, ...l, available: l.builtIn || llmEnabled() })),
  catalogue,
  needs: Object.fromEntries(Object.entries(NEEDS).map(([k, v]) => [k, { en: v.en, hi: v.hi, products: v.products }])),
  cities: Object.values(cities),
  samples: sampleApplicants(),
  followupStatuses: FOLLOWUP_STATUSES,
}));

// ---------------- applications / advisor ----------------
app.post('/api/applications', wrap(async (req, res) => {
  const lang = LANGS[req.body?.language] ? req.body.language : 'en';
  const id = newId('APP', 10);
  const start = await advisorStart(lang);
  const transcript = start.messages.map((text) => ({ role: 'advisor', text, ts: now() }));
  transcript.push({ role: 'advisor', text: start.question.text, ts: now(), kind: 'question', slot: start.question.slot });
  run('INSERT INTO applications (id, created_at, updated_at, language, stage, profile_json, transcript_json) VALUES (?,?,?,?,?,?,?)',
    [id, now(), now(), lang, 'advisor', '{}', JSON.stringify(transcript)]);
  audit(id, 'application_created', { lang });
  res.json({ ...loadApp(id), question: start.question });
}));

app.get('/api/applications/:id', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  const slot = a.stage === 'advisor' ? nextSlot(a.profile) : null;
  const question = slot ? await questionFor(slot, a.profile, a.language) : null;
  res.json({ ...publicApp(a), question, consent: hasConsent(a.id) });
}));

app.post('/api/applications/:id/advisor', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  const { text, answer, language } = req.body || {};
  if (language && LANGS[language]) a.language = language;
  if (text) a.transcript.push({ role: 'user', text: String(text).slice(0, 1000), ts: now() });
  if (answer) a.transcript.push({ role: 'user', text: answer.label || String(answer.value), ts: now(), slot: answer.slot });
  const out = await advisorTurn({ profile: a.profile }, { text, answer }, a.language);
  a.profile = out.profile;
  out.messages.forEach((m) => a.transcript.push({ role: 'advisor', text: m, ts: now() }));
  if (out.question) a.transcript.push({ role: 'advisor', text: out.question.text, ts: now(), kind: 'question', slot: out.question.slot });
  if (out.recommendation) {
    const rec = out.recommendation;
    a.stage = 'quote';
    a.selection = {
      term: rec.term,
      lines: rec.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      summary: rec.summary,
      explainedBy: rec.explainedBy,
      reasons: Object.fromEntries(rec.items.map((i) => [i.productId, i.reasonText])),
    };
    audit(a.id, 'recommendation', { products: a.selection.lines, explainedBy: rec.explainedBy });
  }
  saveApp(a);
  res.json({
    ...out,
    recommendation: out.recommendation ? { ...out.recommendation, summary: a.selection.summary } : null,
    transcript: a.transcript,
    stage: a.stage,
    quote: a.selection ? priceQuote(a.selection, a.profile) : null,
    selection: a.selection,
  });
}));

// Owner edits the bundle (toggle add-ons, quantities, term, swap connection).
app.put('/api/applications/:id/selection', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  const { lines, term } = req.body || {};
  if (!Array.isArray(lines)) return res.status(400).json({ error: 'lines required' });
  a.selection = { ...(a.selection || {}), lines: lines.filter((l) => productById[l.productId]).map((l) => ({ productId: l.productId, qty: Number(l.qty) || 1 })), term: Number(term) || 12 };
  if (req.body.stage && ['quote', 'kyc', 'checkout'].includes(req.body.stage)) a.stage = req.body.stage;
  saveApp(a);
  res.json({ selection: a.selection, quote: priceQuote(a.selection, a.profile) });
}));

// Stateless price check (used by the bundle builder for instant feedback).
app.post('/api/quote', (req, res) => res.json(priceQuote(req.body || {}, req.body?.profile || {})));

// ---------------- registry lookups (MOCK) ----------------
app.get('/api/registry/gstin/:gstin', (req, res) => {
  const v = validateGstin(req.params.gstin);
  const r = v.valid ? gstinRegistry.get(v.gstin) : null;
  audit(null, 'gstin_lookup', { gstin: maskGstin(v.gstin), found: Boolean(r) });
  res.json({ mock: true, valid: v.valid, errors: v.errors, found: Boolean(r), record: r ? { legalName: r.legal_name, tradeName: r.trade_name, constitution: r.constitution, address: r.principal_place_of_business, state: r.state, registrationDate: r.registration_date, status: r.status } : null });
});
app.get('/api/registry/udyam/:num', (req, res) => {
  const r = udyamRegistry.get(String(req.params.num).toUpperCase());
  res.json({ mock: true, found: Boolean(r), record: r ? { enterpriseName: r.enterprise_name, type: r.enterprise_type, activity: r.major_activity, nic: r.nic_description, state: r.state, city: r.city, registrationDate: r.date_of_registration } : null });
});

// ---------------- consent + KYC ----------------
export const CONSENT_VERSION = 'UD-KYC-2026-1';
app.post('/api/applications/:id/consent', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  const purposes = Array.isArray(req.body?.purposes) ? req.body.purposes : [];
  if (!purposes.includes('kyc')) return res.status(400).json({ error: 'Consent for KYC verification is required to continue' });
  run('INSERT INTO consents (application_id, notice_version, purposes_json, language, given_at) VALUES (?,?,?,?,?)',
    [a.id, CONSENT_VERSION, JSON.stringify(purposes), a.language, now()]);
  audit(a.id, 'consent_given', { purposes, version: CONSENT_VERSION });
  a.stage = 'kyc';
  saveApp(a);
  res.json({ ok: true, version: CONSENT_VERSION, givenAt: now() });
}));

app.post('/api/applications/:id/consent/withdraw', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  run('UPDATE consents SET withdrawn_at = ? WHERE application_id = ? AND withdrawn_at IS NULL', [now(), a.id]);
  a.kyc = null;
  a.profile = { ...a.profile, kycStatus: null };
  saveApp(a);
  audit(a.id, 'consent_withdrawn_kyc_erased');
  res.json({ ok: true });
}));

function hasConsent(id) {
  return Boolean(get('SELECT id FROM consents WHERE application_id = ? AND withdrawn_at IS NULL', [id]));
}

app.post('/api/applications/:id/kyc', upload.array('files', 6), wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  if (!hasConsent(a.id)) return res.status(403).json({ error: 'Please give consent before uploading documents' });
  let files;
  let ctx = { gstin: a.profile.gstinStatus && a.profile.gstin ? a.profile.gstin : null, businessName: a.profile.businessName, hasGstin: a.profile.hasGstin, applicantName: req.body?.applicantName || a.contactName };
  if (req.body?.sample) {
    files = sampleFiles(req.body.sample);
    if (!files.length) return res.status(400).json({ error: 'Unknown sample' });
    const sc = await sampleContext(req.body.sample);
    ctx = { ...ctx, ...sc, gstin: null, applicantName: req.body.applicantName || sc.applicantName };
  } else {
    const hints = [].concat(req.body?.types || []);
    files = (req.files || []).map((f, i) => ({ name: f.originalname, buffer: f.buffer, hint: hints[i] }));
    if (!files.length) return res.status(400).json({ error: 'No documents uploaded' });
  }
  const result = await runKyc(files, ctx);
  // Feed verified facts back into eligibility (e.g. a cancelled GSTIN removes GST-only products).
  const f = result.facts;
  if (f.gstin) {
    a.profile.gstin = f.gstin;
    a.profile.gstinStatus = f.status || (gstinRegistry.get(f.gstin)?.status) || 'Not found';
    a.profile.hasGstin = true;
  }
  if (f.tradeName) a.profile.businessName = f.tradeName;
  a.profile.kycStatus = result.status;
  if (ctx.applicantName && !a.contactName) a.contactName = ctx.applicantName;
  // Persist only the verification summary — never images or full identifiers.
  const { gstin: _omit, ...safeFacts } = f;
  a.kyc = { ...result, facts: safeFacts, sample: req.body?.sample || null, applicantName: ctx.applicantName || null };
  saveApp(a);
  audit(a.id, 'kyc_checked', { status: result.status, fails: result.checks.filter((c) => c.status === 'fail').map((c) => c.id) });
  res.json({ kyc: a.kyc, quote: a.selection ? priceQuote(a.selection, a.profile) : null, profile: a.profile });
}));

// ---------------- orders ----------------
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
const ymd = (d) => d.toISOString().slice(0, 10);

export function installSlots(quote) {
  const lead = Math.max(1, ...quote.lines.map((l) => l.installDays));
  const first = addDays(new Date(), lead);
  const out = [];
  for (let i = 0; out.length < 6 && i < 14; i++) {
    const d = addDays(first, i);
    if (d.getDay() === 0) continue; // no Sunday installs
    out.push(ymd(d));
  }
  return { earliest: out[0], dates: out, windows: ['09:00–12:00', '12:00–15:00', '15:00–18:00'], leadDays: lead };
}

app.get('/api/applications/:id/slots', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a?.selection) return res.status(404).json({ error: 'No bundle yet' });
  res.json(installSlots(priceQuote(a.selection, a.profile)));
}));

app.post('/api/applications/:id/order', wrap(async (req, res) => {
  const a = loadApp(req.params.id);
  if (!a) return res.status(404).json({ error: 'Application not found' });
  if (a.orderId) return res.json({ orderId: a.orderId });
  const quote = priceQuote(a.selection || {}, a.profile);
  if (!quote.valid) return res.status(400).json({ error: 'Some items in the bundle are not available for you. Please review the bundle.', issues: quote.issues });
  if (a.kyc?.status !== 'verified') return res.status(400).json({ error: 'Business verification must pass before placing the order.' });
  const { contactName, phone, date, window: win, accept } = req.body || {};
  if (!accept) return res.status(400).json({ error: 'Please accept the terms and e-sign to continue' });
  if (!contactName || !/^[6-9]\d{9}$/.test(String(phone || '').replace(/\D/g, '').slice(-10))) return res.status(400).json({ error: 'Enter your name and a valid 10-digit mobile number' });
  const slots = installSlots(quote);
  if (!slots.dates.includes(date) || !slots.windows.includes(win)) return res.status(400).json({ error: 'Please choose an available installation slot' });

  const id = 'UD' + new Date().getFullYear().toString().slice(2) + '-' + crypto.randomInt(100000, 999999);
  const placed = now();
  const timeline = [
    { key: 'placed', label: 'Order placed', at: placed, done: true },
    { key: 'kyc_verified', label: 'Business verified', at: placed, done: true, note: 'Smart KYC passed instantly' },
    { key: 'install_scheduled', label: 'Installation scheduled', at: placed, done: true, note: `${date}, ${win}`, due: date },
    { key: 'activated', label: 'Activated', done: false, due: date, note: 'Engineer installs and activates on the visit' },
  ];
  const items = quote.lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, eta: ymd(addDays(new Date(), Math.min(l.installDays, slots.leadDays))), installDays: l.installDays }));
  run('INSERT INTO orders (id, application_id, created_at, business_name, quote_json, install_slot, status, timeline_json) VALUES (?,?,?,?,?,?,?,?)', [
    id, a.id, placed, a.profile.businessName || a.profile.businessType || 'Business', JSON.stringify({ ...quote, items }), `${date} ${win}`, 'install_scheduled', JSON.stringify(timeline),
  ]);
  a.orderId = id;
  a.stage = 'ordered';
  a.contactName = String(contactName).slice(0, 80);
  a.phoneMasked = '••••••' + String(phone).replace(/\D/g, '').slice(-4);
  saveApp(a);
  audit(a.id, 'order_placed', { orderId: id, monthly: quote.monthly });
  res.json({ orderId: id });
}));

function loadOrder(id) {
  const o = get('SELECT * FROM orders WHERE id = ?', [String(id).toUpperCase()]);
  if (!o) return null;
  const a = loadApp(o.application_id);
  return {
    id: o.id, createdAt: o.created_at, businessName: o.business_name, installSlot: o.install_slot, status: o.status,
    timeline: parse(o.timeline_json, []), quote: parse(o.quote_json, {}),
    contactName: a?.contactName, phoneMasked: a?.phoneMasked, city: a?.profile?.city, language: a?.language,
    installAddress: a?.kyc?.facts?.installAddress || a?.kyc?.facts?.address || null,
  };
}

app.get('/api/orders/:id', (req, res) => {
  const o = loadOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'We could not find that order ID' });
  res.json(o);
});
app.get('/api/orders', (req, res) => {
  res.json(all('SELECT id FROM orders ORDER BY created_at DESC LIMIT 100').map((r) => loadOrder(r.id)));
});
// Ops: move an order to its next stage (engineer visit done -> activated).
app.post('/api/orders/:id/advance', (req, res) => {
  const o = loadOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  const next = o.timeline.find((s) => !s.done);
  if (next) { next.done = true; next.at = now(); }
  const status = next ? next.key : o.status;
  run('UPDATE orders SET status = ?, timeline_json = ? WHERE id = ?', [status, JSON.stringify(o.timeline), o.id]);
  res.json(loadOrder(o.id));
});

// ---------------- console ----------------
app.get('/api/analytics', (req, res) => {
  const a = analytics();
  const apps = all('SELECT stage, kyc_json, created_at, updated_at, order_id FROM applications');
  const orders = all('SELECT created_at, quote_json, application_id FROM orders');
  const appCreated = Object.fromEntries(all('SELECT id, created_at FROM applications').map((r) => [r.id, r.created_at]));
  const mins = orders.map((o) => (new Date(o.created_at) - new Date(appCreated[o.application_id])) / 60000).filter((x) => x >= 0);
  const digital = {
    journeys: apps.length,
    reachedQuote: apps.filter((x) => x.stage !== 'advisor').length,
    kycVerified: apps.filter((x) => parse(x.kyc_json, {})?.status === 'verified').length,
    orders: orders.length,
    medianMinutesToOrder: mins.length ? Math.round([...mins].sort((p, q) => p - q)[mins.length >> 1] * 10) / 10 : null,
    monthlyValue: orders.reduce((s, o) => s + (parse(o.quote_json, {}).monthly || 0), 0),
  };
  res.json({ ...a, digital });
});
app.get('/api/leads', (req, res) => res.json(listLeads(req.query)));
app.get('/api/leads/:id', (req, res) => {
  const l = getLead(req.params.id);
  if (!l) return res.status(404).json({ error: 'Lead not found' });
  res.json(l);
});
app.post('/api/leads/:id/followup', wrap(async (req, res) => {
  if (!getLead(req.params.id)) return res.status(404).json({ error: 'Lead not found' });
  res.json(setFollowup(req.params.id, req.body?.status, req.body?.note));
}));
app.post('/api/leads/:id/suggest', wrap(async (req, res) => {
  const s = await suggestApproach(req.params.id);
  if (!s) return res.status(404).json({ error: 'Lead not found' });
  res.json(s);
}));

// Specimen images for the KYC demo picker (synthetic documents only).
app.use('/api/samples', express.static(KYC_DIR, { maxAge: '1h' }));

// Serve the built client in production.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = Number(process.env.PORT) || 8787;
await initDb();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Udyam Digital API on http://localhost:${PORT}  (AI: ${llmInfo().provider}${llmInfo().model ? ' / ' + llmInfo().model : ''})`);
  warmUp();
  analytics();
});
