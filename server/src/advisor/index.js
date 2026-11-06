// Advisor conversation engine.
// A slot-filling state machine decides WHAT to ask next (predictable, testable, never loops);
// the LLM, when available, understands free-form answers in any language and writes the explanation.
import { cities, businessTypes, gstinRegistry, udyamRegistry, productById, catalogue } from '../data.js';
import { extractRules, segmentFor, normaliseType, INTERNET, NEED_RULES, findCity } from './extract.js';
import { COPY, CHIPS, LANGS, NEEDS_BY_SEGMENT, fill } from './copy.js';
import { recommend, NEEDS, SEGMENT_DEFAULT_NEEDS } from '../engine/recommend.js';
import { validateGstin, repairGstin, lookalikeCandidates } from '../kyc/gstin.js';
import { generate, llmEnabled } from '../llm.js';

const SLOTS = ['businessType', 'segment', 'city', 'employees', 'sites', 'currentInternet', 'needs', 'gstin'];

const t = (lang, key, params) => fill((COPY[lang] || COPY.en)[key] || COPY.en[key], params);

export function nextSlot(p) {
  if (!p.businessType) return 'businessType';
  if (!p.segment) return 'segment';
  if (!p.city) return 'city';
  if (!p.employees) return 'employees';
  if (!p.sites) {
    if (p.segment === 'multi' || /chain|group/i.test(p.businessType)) return 'sites';
  }
  if (!p.currentInternet) return 'currentInternet';
  if (!p.needsConfirmed) return 'needs';
  if (!p.gstinAsked) return 'gstin';
  return null;
}

// ---------- translation for languages without built-in copy ----------
const tcache = new Map();
async function translate(strings, lang) {
  if (LANGS[lang]?.builtIn || !llmEnabled()) return strings;
  const key = lang + '|' + strings.join('§');
  if (tcache.has(key)) return tcache.get(key);
  const out = await generate({
    system: `Translate UI strings for an Indian small-business owner into ${LANGS[lang].label}. Keep brand names (Accel, WhatsApp, GSTIN, UPI) in Latin script. Use simple everyday words. Return JSON: {"t": [..same order..]}`,
    prompt: JSON.stringify(strings),
    json: true,
  });
  const res = Array.isArray(out?.t) && out.t.length === strings.length ? out.t : strings;
  tcache.set(key, res);
  return res;
}

export async function questionFor(slot, p, lang) {
  const base = LANGS[lang]?.builtIn ? lang : 'en';
  let q = { slot, text: t(base, 'q_' + slot), chips: [], multi: false, input: 'text' };
  if (CHIPS[slot]) q.chips = CHIPS[slot].values.map((v, i) => ({ value: v, label: CHIPS[slot][base][i] }));
  if (slot === 'businessType') q.chips.push({ value: '__other', label: t(base, 'something_else') });
  if (slot === 'currentInternet' && p.segment !== 'multi') q.chips = q.chips.filter((c) => c.value !== 'Mixed per site');
  if (slot === 'employees' || slot === 'sites') q.input = 'number';
  if (slot === 'needs') {
    const list = NEEDS_BY_SEGMENT[p.segment] || NEEDS_BY_SEGMENT.micro;
    const extra = (p.needs || []).filter((n) => !list.includes(n));
    q.chips = [...extra, ...list].map((n) => ({ value: n, label: NEEDS[n][base === 'hi' ? 'hi' : 'en'] }));
    q.multi = true;
    q.defaults = p.needs?.length ? p.needs : SEGMENT_DEFAULT_NEEDS[p.segment] || [];
    q.doneLabel = t(base, 'chips_done');
  }
  if (slot === 'gstin') {
    q.input = 'gstin';
    q.chips = [{ value: '__none', label: t(base, 'chip_no_gstin') }, { value: '__later', label: t(base, 'chip_later') }];
  }
  if (!LANGS[lang]?.builtIn && llmEnabled()) {
    const strings = [q.text, ...q.chips.map((c) => c.label), ...(q.doneLabel ? [q.doneLabel] : [])];
    const tr = await translate(strings, lang);
    q.text = tr[0];
    q.chips = q.chips.map((c, i) => ({ ...c, label: tr[i + 1] }));
    if (q.doneLabel) q.doneLabel = tr[tr.length - 1];
  }
  return q;
}

// ---------- understanding ----------
const TYPE_LIST = Object.keys(businessTypes);
const NEED_KEYS = Object.keys(NEEDS);

async function extractLLM(text, profile, expecting, lang) {
  if (!llmEnabled()) return null;
  const system = `You extract facts about an Indian small business from what the owner types (any language, Hinglish, typos).
Return ONLY JSON with these keys (use null when not stated — never guess):
{"business_type": one of ${JSON.stringify(TYPE_LIST)} or a short English description if none fits, or null,
 "segment_hint": "micro"|"prof"|"multi"|"mfg"|null  (micro=single shop/local service, prof=office/clinic/classes, multi=2+ outlets/branches, mfg=factory/workshop),
 "business_name": string|null,
 "city": city name in English|null,
 "employees": integer|null,
 "sites": integer|null,
 "current_internet": one of ${JSON.stringify(INTERNET)}|null,
 "needs": subset of ${JSON.stringify(NEED_KEYS)} that the owner actually expressed,
 "requested_products": product IDs the owner asked for BY NAME from this catalogue: ${JSON.stringify(catalogue.map((p) => `${p.id}=${p.name}`))},
 "has_gstin": true|false|null,
 "gstin": 15-char GSTIN if typed|null,
 "acknowledgement": one short, warm sentence in ${LANGS[lang]?.label || 'English'} restating only what you understood. No prices, no product recommendations, no questions.}
needs meanings: payments=billing/UPI/card; whatsapp; sms; cctv; email=business email/office docs; backup=file backup; security=antivirus/ransomware/data protection; calls=IVR/business phone; tollfree; website; uptime=internet must never go down; guestwifi=Wi-Fi for customers; remote=static IP/remote access; central=manage many sites centrally; machines=machine IoT monitoring; fleet=vehicle tracking.`;
  const prompt = `Known so far: ${JSON.stringify(profile)}\nThe advisor just asked about: ${expecting || 'anything'}\nOwner wrote: """${text}"""`;
  return generate({ system, prompt, json: true, timeoutMs: 9000 });
}

function mergeExtraction(profile, ex, llm) {
  const p = { ...profile };
  const set = (k, v) => { if (v !== null && v !== undefined && v !== '') p[k] = v; };
  set('businessType', ex.businessType);
  set('segmentHint', ex.segmentHint);
  set('city', ex.city);
  set('employees', ex.employees);
  set('sites', ex.sites);
  set('currentInternet', ex.currentInternet);
  set('gstin', ex.gstin);
  set('udyam', ex.udyam);
  if (ex.hasGstin !== undefined) p.hasGstin = ex.hasGstin;
  let needs = new Set([...(p.needs || []), ...(ex.needs || [])]);
  let requested = new Set([...(p.requested || []), ...(ex.requested || [])]);
  if (llm) {
    if (llm.business_type && (!ex.businessType || TYPE_LIST.includes(llm.business_type))) p.businessType = llm.business_type;
    set('segmentHint', ['micro', 'prof', 'multi', 'mfg'].includes(llm.segment_hint) ? llm.segment_hint : null);
    set('businessName', llm.business_name);
    if (llm.city) p.city = findCity(llm.city) || llm.city;
    if (Number.isInteger(llm.employees) && llm.employees > 0) p.employees = llm.employees;
    if (Number.isInteger(llm.sites) && llm.sites > 0) p.sites = llm.sites;
    if (INTERNET.includes(llm.current_internet)) p.currentInternet = llm.current_internet;
    (llm.needs || []).filter((n) => NEED_KEYS.includes(n)).forEach((n) => needs.add(n));
    (llm.requested_products || []).filter((id) => productById[id]).forEach((id) => requested.add(id));
    if (typeof llm.has_gstin === 'boolean') p.hasGstin = llm.has_gstin;
    if (llm.gstin && !p.gstin) p.gstin = String(llm.gstin).toUpperCase();
  }
  p.needs = [...needs];
  p.requested = [...requested];
  return p;
}

// Derive segment / tier / normalised type after every change.
function derive(p) {
  const out = { ...p };
  if (out.businessType) {
    out.businessType = normaliseType(out.businessType, out.sites || 1);
    const seg = segmentFor(out.businessType, out.sites || 1, out.segmentHint);
    if (seg) out.segment = seg;
  }
  if (out.city) {
    const c = cities[out.city];
    out.tier = c ? c.tier : 2;
    out.state = c ? c.state : out.state || null;
    out.cityKnown = Boolean(c);
  }
  if (out.segment && out.segment !== 'multi' && !out.sites && !/chain|group/i.test(out.businessType || '')) out.sites = 1;
  if (out.segment === 'multi' && out.sites === 1) out.segment = 'micro';
  return out;
}

// ---------- GSTIN ----------
function applyGstin(p, raw, lang) {
  const msgs = [];
  const base = LANGS[lang]?.builtIn ? lang : 'en';
  let v = validateGstin(raw);
  if (!v.valid) {
    const r = repairGstin(raw);
    const v2 = validateGstin(r.gstin);
    if (v2.valid) v = v2;
    else {
      const cand = lookalikeCandidates(r.gstin).find((c) => gstinRegistry.has(c));
      if (cand) v = validateGstin(cand);
    }
  }
  p.gstinAsked = true;
  if (!v.valid) {
    p.gstinStatus = 'Invalid';
    p.hasGstin = true;
    msgs.push(t(base, 'gst_invalid', { why: v.errors[0] }));
    return msgs;
  }
  p.gstin = v.gstin;
  p.hasGstin = true;
  const reg = gstinRegistry.get(v.gstin);
  if (!reg) {
    p.gstinStatus = 'Not found';
    msgs.push(t(base, 'gst_notfound', { gstin: v.gstin }));
    return msgs;
  }
  p.gstinStatus = reg.status;
  p.registry = { legalName: reg.legal_name, tradeName: reg.trade_name, constitution: reg.constitution, address: reg.principal_place_of_business, state: reg.state };
  p.businessName = reg.trade_name;
  const regCity = findCity(reg.principal_place_of_business);
  if (regCity && !p.city) p.city = regCity;
  msgs.push(t(base, 'gst_found', { name: reg.trade_name, city: regCity || reg.state, status: reg.status }));
  if (reg.status !== 'Active') msgs.push(t(base, 'gst_inactive', { status: reg.status.toLowerCase() }));
  // If an Udyam number came with it, use its NIC description as the business type.
  if (p.udyam && udyamRegistry.has(p.udyam) && !p.businessType) p.businessType = udyamRegistry.get(p.udyam).nic_description;
  return msgs;
}

function ackFallback(before, after, lang) {
  const base = lang === 'hi' ? 'hi' : 'en';
  const bits = [];
  if (after.businessType && after.businessType !== before.businessType) {
    const i = CHIPS.businessType.values.indexOf(after.businessType);
    bits.push(base === 'hi' && i >= 0 ? CHIPS.businessType.hi[i] : after.businessType.toLowerCase());
  }
  if (after.city && after.city !== before.city) bits.push((base === 'hi' ? '' : 'in ') + after.city);
  if (after.employees && after.employees !== before.employees) bits.push(base === 'hi' ? `${after.employees} लोग` : `${after.employees} ${after.employees === 1 ? 'person' : 'people'}`);
  if (after.sites > 1 && after.sites !== before.sites) bits.push(base === 'hi' ? `${after.sites} लोकेशन` : `${after.sites} locations`);
  const newNeeds = (after.needs || []).filter((n) => !(before.needs || []).includes(n));
  // Lower-case only the first letter in English ("billing & card/UPI payments"); Hindi stays as written.
  if (newNeeds.length) bits.push(newNeeds.map((n) => (base === 'hi' ? NEEDS[n].hi : (/^[A-Z][a-z]/.test(NEEDS[n].en) ? NEEDS[n].en[0].toLowerCase() + NEEDS[n].en.slice(1) : NEEDS[n].en))).join(', '));
  if (!bits.length) return null;
  return `${t(base, 'ack_prefix')} — ${bits.join(', ')}.`;
}

// ---------- explanation ----------
export async function explain(profile, rec, lang) {
  const base = LANGS[lang]?.builtIn ? lang : 'en';
  const names = rec.items.map((i) => i.name);
  const fallback = base === 'hi'
    ? `${profile.city || ''} में आपके ${profile.businessType || 'व्यवसाय'} (${profile.employees || 1} लोग) के लिए मैंने ${names.length} सेवाएँ चुनी हैं। सब कुछ एक बिल, एक सपोर्ट नंबर पर।${rec.unavailable.length ? ' कुछ चीज़ें आपके लिए अभी उपलब्ध नहीं हैं — कारण नीचे दिए हैं।' : ''} आगे बढ़ने से पहले आप मात्रा बदल सकते हैं या सेवाएँ जोड़/हटा सकते हैं।`
    : `For ${/^[aeiou]/i.test(profile.businessType || 'b') ? 'an' : 'a'} ${(profile.businessType || 'business').toLowerCase()} in ${profile.city || 'your city'} with ${profile.employees || 1} ${profile.employees === 1 ? 'person' : 'people'}, I've put together ${names.length} services on one bill and one support number: ${names.join(', ')}.${rec.unavailable.length ? ` A few things you asked about aren't available for you yet — I've explained why below.` : ''} You can change quantities or switch extras on and off before you continue.`;
  if (!llmEnabled()) return { summary: fallback, reasons: null, source: 'rules' };

  const out = await generate({
    system: `You are a friendly telecom advisor for Indian small-business owners. Write in ${LANGS[lang]?.label || 'English'}, plain everyday words, no jargon, no prices or numbers of rupees.
You must ONLY talk about the products given to you; never suggest other products. Return JSON:
{"summary": "2-3 sentences explaining why this bundle fits THIS business", "reasons": {"<productId>": "one short line why, in ${LANGS[lang]?.label || 'English'}"}}`,
    prompt: JSON.stringify({
      business: { type: profile.businessType, city: profile.city, employees: profile.employees, sites: profile.sites, current_internet: profile.currentInternet, needs: profile.needs, gstin_status: profile.gstinStatus || 'not provided' },
      bundle: rec.items.map((i) => ({ id: i.productId, name: i.name, qty: i.qty, description: productById[i.productId].description, why: i.reasonText })),
      not_available: rec.unavailable.map((u) => ({ name: u.name, why: u.why })),
    }),
    json: true,
    temperature: 0.4,
  });
  if (!out?.summary) return { summary: fallback, reasons: null, source: 'rules' };
  return { summary: out.summary, reasons: base === 'en' || base === 'hi' ? null : out.reasons || null, source: 'llm' };
}

// ---------- main turn ----------
export async function advisorTurn(state, input, lang) {
  let profile = { ...(state.profile || {}) };
  const messages = [];
  const before = { ...profile };
  const expecting = nextSlot(derive(profile));

  if (input?.answer) {
    const { slot, value } = input.answer;
    if (slot === 'businessType') {
      if (value === '__other') { profile.businessTypeOther = true; }
      else profile.businessType = value;
    } else if (slot === 'segment') profile.segment = profile.segmentHint = value;
    else if (slot === 'city') profile.city = value;
    else if (slot === 'employees') profile.employees = Number(value);
    else if (slot === 'sites') profile.sites = Number(value);
    else if (slot === 'currentInternet') profile.currentInternet = value;
    else if (slot === 'needs') { profile.needs = Array.isArray(value) ? value.filter((n) => NEEDS[n]) : []; profile.needsConfirmed = true; }
    else if (slot === 'gstin') {
      if (value === '__none') { profile.hasGstin = false; profile.gstinAsked = true; profile.gstinStatus = null; messages.push(t(LANGS[lang]?.builtIn ? lang : 'en', 'gst_skip')); }
      else if (value === '__later') { profile.hasGstin = null; profile.gstinAsked = true; }
      else messages.push(...applyGstin(profile, value, lang));
    }
  } else if (input?.text) {
    const text = String(input.text).slice(0, 1000);
    // A typed answer that matches an option label is treated like tapping that option.
    const chipHit = expecting && CHIPS[expecting] && (() => {
      const n = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      for (const lg of ['en', 'hi']) {
        const i = CHIPS[expecting][lg].findIndex((l) => n(l) === n(text));
        if (i >= 0) return CHIPS[expecting].values[i];
      }
      return null;
    })();
    if (chipHit != null) return advisorTurn(state, { answer: { slot: expecting, value: chipHit } }, lang);
    const ex = extractRules(text, expecting);
    const llm = await extractLLM(text, derive(profile), expecting, lang);
    profile = mergeExtraction(profile, ex, llm);
    if (expecting === 'needs' && (ex.needs.length || llm?.needs?.length)) profile.needsConfirmed = true;
    if (expecting === 'gstin' && !profile.gstin && profile.hasGstin === false) {
      profile.gstinAsked = true;
      messages.push(t(LANGS[lang]?.builtIn ? lang : 'en', 'gst_skip'));
    }
    if (profile.gstin && profile.gstin !== before.gstin) messages.unshift(...applyGstin(profile, profile.gstin, lang));
    else if (expecting === 'gstin' && /[0-9A-Z]{13,}/i.test(text.replace(/\s/g, '')) && !profile.gstin) {
      messages.push(...applyGstin(profile, text.replace(/\s/g, ''), lang));
    }
    const ack = llm?.acknowledgement || ackFallback(derive(before), derive(profile), lang);
    if (ack) messages.unshift(ack);
  }

  profile = derive(profile);
  // If the same question is still open after a free-text reply, say so (and stop asking optional ones).
  const stillOpen = input?.text && expecting && nextSlot(profile) === expecting;
  if (stillOpen) {
    profile._miss = { ...(profile._miss || {}), [expecting]: (profile._miss?.[expecting] || 0) + 1 };
    if (profile._miss[expecting] >= 2 && expecting === 'currentInternet') profile.currentInternet = 'Not sure';
    else if (profile._miss[expecting] >= 2 && expecting === 'needs') profile.needsConfirmed = true;
    else if (profile._miss[expecting] >= 2 && expecting === 'sites') profile.sites = 1;
    else messages.push(t(LANGS[lang]?.builtIn ? lang : 'en', 'didnt_get'));
  }
  if (profile.city && !profile.cityKnown && profile.city !== before.city) {
    messages.push(t(LANGS[lang]?.builtIn ? lang : 'en', 'city_unknown', { city: profile.city }));
  }

  const slot = nextSlot(profile);
  const result = { profile, messages, question: null, recommendation: null };
  if (slot) {
    result.question = await questionFor(slot, profile, lang);
    if (profile.businessTypeOther && slot === 'businessType') result.question.chips = [];
  } else {
    const rec = recommend(profile, LANGS[lang]?.builtIn ? lang : 'en');
    const ex = await explain(profile, rec, lang);
    if (ex.reasons) rec.items = rec.items.map((i) => ({ ...i, reasonText: ex.reasons[i.productId] || i.reasonText }));
    result.recommendation = { ...rec, summary: ex.summary, explainedBy: ex.source };
    messages.push(t(LANGS[lang]?.builtIn ? lang : 'en', 'ready'));
  }
  // Translate fixed system messages for non built-in languages.
  if (!LANGS[lang]?.builtIn && llmEnabled() && messages.length) {
    result.messages = await translate(messages, lang);
  }
  return result;
}

export async function advisorStart(lang) {
  const base = LANGS[lang]?.builtIn ? lang : 'en';
  let greet = t(base, 'greet');
  if (!LANGS[lang]?.builtIn && llmEnabled()) [greet] = await translate([greet], lang);
  return { messages: [greet], question: await questionFor('businessType', {}, lang), profile: {} };
}

export { SLOTS };
