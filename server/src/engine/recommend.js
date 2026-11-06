// Deterministic bundle recommender: business profile -> catalogue products, quantities and reasons.
// The LLM never chooses products or prices; it only fills the profile and rephrases the reasons.
import { productById } from '../data.js';
import { eligibilityFailures, dependencyMissing, failureText, CONNECTIVITY_MAIN } from './catalogue-rules.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Needs the advisor can capture -> catalogue products that serve them.
export const NEEDS = {
  payments: { products: ['P19'], en: 'Billing & card/UPI payments', hi: 'बिलिंग और कार्ड/UPI भुगतान' },
  whatsapp: { products: ['P15'], en: 'Reach customers on WhatsApp', hi: 'WhatsApp पर ग्राहकों से जुड़ना' },
  sms: { products: ['P14'], en: 'SMS alerts & offers', hi: 'SMS अलर्ट और ऑफ़र' },
  cctv: { products: ['P23'], en: 'CCTV cameras', hi: 'CCTV कैमरे' },
  email: { products: ['P16'], en: 'Business email & documents', hi: 'बिज़नेस ईमेल और डॉक्यूमेंट' },
  backup: { products: ['P17'], en: 'Back up important files', hi: 'ज़रूरी फ़ाइलों का बैकअप' },
  security: { products: ['P20', 'P21'], en: 'Protect PCs from viruses & ransomware', hi: 'कंप्यूटर को वायरस से सुरक्षा' },
  calls: { products: ['P12'], en: 'Business phone line with IVR', hi: 'IVR वाली बिज़नेस फ़ोन लाइन' },
  tollfree: { products: ['P13'], en: '1800 toll-free number', hi: '1800 टोल-फ़्री नंबर' },
  website: { products: ['P18'], en: 'Website & own domain', hi: 'वेबसाइट और अपना डोमेन' },
  uptime: { products: ['P09'], en: 'Internet that never goes down', hi: 'कभी न रुकने वाला इंटरनेट' },
  guestwifi: { products: ['P22'], en: 'Wi-Fi for customers', hi: 'ग्राहकों के लिए Wi-Fi' },
  remote: { products: ['P11'], en: 'Remote access / static IP', hi: 'रिमोट एक्सेस / स्टैटिक IP' },
  central: { products: ['P10'], en: 'Manage all sites centrally', hi: 'सभी शाखाएँ एक जगह से संभालना' },
  machines: { products: ['P24'], en: 'Monitor machines (IoT)', hi: 'मशीनों की निगरानी (IoT)' },
  fleet: { products: ['P25'], en: 'Track vehicles', hi: 'गाड़ियों की ट्रैकिंग' },
};

// Sensible defaults per segment, drawn from what activated customers in smb_leads.csv actually bought.
export const SEGMENT_DEFAULT_NEEDS = {
  micro: ['payments'],
  prof: ['email', 'security', 'backup'],
  multi: ['payments', 'cctv', 'uptime'],
  mfg: ['email', 'security', 'cctv'],
};

function pickConnectivity(profile) {
  const { segment, employees = 1, sites = 1, currentInternet } = profile;
  const ok = (id) => eligibilityFailures(id, profile).length === 0;
  const perSite = Math.max(1, Math.round(employees / Math.max(sites, 1)));
  let order;
  if (segment === 'mfg') order = ['P06', 'P05', 'P03', 'P02', 'P01'].filter((id) => id !== 'P06' || employees >= 50);
  else if (segment === 'prof') order = employees >= 15 ? ['P03', 'P02', 'P01'] : employees >= 5 ? ['P02', 'P01'] : ['P01', 'P04'];
  else if (segment === 'multi') order = perSite >= 5 ? ['P02', 'P01'] : ['P01', 'P02'];
  else order = currentInternet === 'None' ? ['P04', 'P01'] : ['P01', 'P04'];
  const pick = order.find(ok) || ['P01', 'P04', 'P02'].find(ok) || null;
  return pick;
}

function quantities(profile) {
  const { segment, employees = 1, sites = 1 } = profile;
  const pcs = segment === 'prof' ? clamp(Math.ceil(employees * 0.6), 2, 25)
    : segment === 'mfg' ? clamp(Math.ceil(employees / 5), 3, 25)
    : segment === 'multi' ? clamp(sites + 2, 3, 25) : 1;
  return {
    lines: segment === 'micro' ? clamp(employees, 1, 2)
      : segment === 'prof' ? clamp(Math.round(employees / 4), 1, 4)
      : segment === 'multi' ? clamp(Math.ceil(sites / 2), 2, 6)
      : clamp(Math.ceil(employees / 20), 2, 5),
    pcs,
    cameras: segment === 'micro' ? 2 : segment === 'mfg' ? 4 : 2 * sites,
    channels: clamp(Math.ceil(employees / 5), 2, 4),
  };
}

// Reason templates. {x} placeholders are filled from params.
const R = {
  link_micro: { en: 'Fast, unlimited fibre so UPI, card machine and billing never stall', hi: 'तेज़ अनलिमिटेड फ़ाइबर ताकि UPI, कार्ड मशीन और बिलिंग कभी न रुके' },
  link_airfiber: { en: 'Plug-and-play 5G broadband — no cabling, installed in about 2 days', hi: 'प्लग-एंड-प्ले 5G ब्रॉडबैंड — बिना तार, लगभग 2 दिन में चालू' },
  link_prof: { en: 'Fibre sized for {emp} people working online at once', hi: '{emp} लोगों के एक साथ ऑनलाइन काम के लिए सही फ़ाइबर' },
  link_multi: { en: 'One fibre line at each of your {sites} locations, on one bill', hi: 'आपकी {sites} लोकेशन पर एक-एक फ़ाइबर लाइन, एक ही बिल में' },
  link_leased: { en: 'Dedicated 1:1 bandwidth with an uptime SLA for your production floor', hi: 'प्रोडक्शन के लिए समर्पित 1:1 बैंडविड्थ और अपटाइम SLA' },
  lines: { en: '{qty} business mobile line(s) for you and key staff', hi: 'आपके और मुख्य स्टाफ़ के लिए {qty} बिज़नेस मोबाइल लाइन' },
  need: { en: 'You asked for: {need}', hi: 'आपने माँगा: {need}' },
  requested: { en: 'You asked for this by name', hi: 'आपने यह नाम से माँगा' },
  dependency: { en: 'Added because {name} needs a fixed broadband link', hi: '{name} के लिए फ़िक्स्ड ब्रॉडबैंड ज़रूरी है' },
  segment_default: { en: 'Most {segment} like yours take this', hi: 'आप जैसे ज़्यादातर व्यवसाय यह लेते हैं' },
};
const SEG_PLURAL = { micro: 'shops', prof: 'offices', multi: 'multi-site businesses', mfg: 'manufacturers' };

export function reasonText(reason, lang = 'en') {
  const t = R[reason.code];
  if (!t) return '';
  let s = (lang === 'hi' ? t.hi : t.en);
  const params = { ...reason.params, segment: SEG_PLURAL[reason.params?.segment] || 'businesses' };
  if (params.need) params.need = NEEDS[params.need]?.[lang === 'hi' ? 'hi' : 'en'] || params.need;
  if (params.name) params.name = productById[params.name]?.name || params.name;
  return s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

export function recommend(profile, lang = 'en') {
  const segment = profile.segment || 'micro';
  const sites = profile.sites || 1;
  const q = quantities({ ...profile, segment });
  const needs = new Set(profile.needs?.length ? profile.needs : SEGMENT_DEFAULT_NEEDS[segment]);
  const requested = new Set(profile.requested || []);
  const items = [];
  const unavailable = [];
  const has = (id) => items.some((i) => i.productId === id);
  const add = (productId, qty, reason) => {
    if (has(productId)) return true;
    const fails = eligibilityFailures(productId, profile);
    if (fails.length) {
      if (!unavailable.some((u) => u.productId === productId)) unavailable.push({ productId, fails });
      return false;
    }
    items.push({ productId, qty, reason });
    return true;
  };

  // 1. Primary connectivity (explicit request wins if eligible).
  // Try every connection the owner asked for by name; ineligible ones are explained, not silently dropped.
  let link = null;
  for (const id of [...requested].filter((x) => CONNECTIVITY_MAIN.includes(x))) {
    if (!link) { if (add(id, sites, { code: 'requested' })) link = id; }
    else { const fails = eligibilityFailures(id, profile); if (fails.length) unavailable.push({ productId: id, fails }); }
  }
  if (!link) {
    link = pickConnectivity({ ...profile, segment });
    if (link) {
      const code = link === 'P04' ? 'link_airfiber' : ['P05', 'P06'].includes(link) ? 'link_leased'
        : segment === 'multi' ? 'link_multi' : segment === 'prof' ? 'link_prof' : 'link_micro';
      add(link, sites, { code, params: { emp: profile.employees, sites } });
    }
  }

  // 2. Business mobile lines (every activated bundle in the data includes them).
  const lineProduct = segment === 'micro' ? 'P07' : 'P08';
  add(lineProduct, q.lines, { code: 'lines', params: { qty: q.lines } });

  // 3. Needs -> products.
  const qtyFor = (id) => ({
    P19: sites, P23: q.cameras, P16: q.pcs, P20: q.pcs, P12: q.channels, P09: sites, P22: sites,
    P10: sites, P21: sites, P24: 4, P25: 2,
  }[id] || 1);
  for (const need of needs) {
    const def = NEEDS[need];
    if (!def) continue;
    for (const id of def.products) {
      // Managed firewall only for the bigger offices; endpoint security covers the rest.
      // (it forces a 24-month term, so only for 25+ staff unless asked for by name).
      if (id === 'P21' && (profile.employees || 1) < 25 && !requested.has('P21')) continue;
      if (id === 'P21' && eligibilityFailures(id, profile).length) continue;
      add(id, qtyFor(id), { code: 'need', params: { need } });
    }
  }

  // 4. Explicitly requested products (non-link).
  for (const id of requested) {
    if (CONNECTIVITY_MAIN.includes(id) || has(id)) continue;
    add(id, qtyFor(id), { code: 'requested' });
  }

  // 5. Resolve dependencies: if something needs a fixed link and we only have AirFiber/none, add fibre.
  const ids = () => items.map((i) => i.productId);
  for (const it of [...items]) {
    const missing = dependencyMissing(it.productId, ids());
    if (!missing) continue;
    const fix = missing.find((d) => eligibilityFailures(d, profile).length === 0 && ['P01', 'P02', 'P03'].includes(d)) || missing.find((d) => eligibilityFailures(d, profile).length === 0);
    if (fix) {
      // Prefer swapping AirFiber for fibre rather than paying for two links.
      const air = items.findIndex((i) => i.productId === 'P04');
      if (air >= 0 && ['P01', 'P02', 'P03'].includes(fix)) items.splice(air, 1);
      add(fix, sites, { code: 'dependency', params: { name: it.productId } });
    } else {
      items.splice(items.indexOf(it), 1);
      unavailable.push({ productId: it.productId, fails: [{ code: 'dependency', options: missing }] });
    }
  }

  // 6. Optional add-ons: eligible products for this segment that are not in the bundle.
  const inBundle = new Set(ids());
  const addonIds = ['P09', 'P15', 'P14', 'P18', 'P22', 'P23', 'P16', 'P17', 'P20', 'P11', 'P19', 'P12', 'P13', 'P21', 'P10', 'P24', 'P25']
    .filter((id) => !inBundle.has(id) && productById[id].segments.includes(segment));
  const addons = [];
  const locked = [];
  for (const id of addonIds) {
    const fails = eligibilityFailures(id, profile);
    const dep = dependencyMissing(id, ids());
    if (!fails.length && !dep) addons.push({ productId: id, qty: qtyFor(id) });
    else if (fails.some((f) => f.code === 'gstin') && fails.length === 1) locked.push({ productId: id, fails });
  }

  // Connectivity alternatives the owner can swap to.
  const linkOptions = CONNECTIVITY_MAIN.filter((id) => eligibilityFailures(id, profile).length === 0
    && (productById[id].segments.includes(segment) || id === link));

  const withText = (arr) => arr.map((i) => ({
    ...i,
    name: productById[i.productId].name,
    reasonText: i.reason ? reasonText(i.reason, lang) : undefined,
  }));
  const failsText = (arr) => arr.map((u) => ({
    ...u,
    name: productById[u.productId].name,
    why: u.fails.map((f) => failureText(f, lang)),
  }));

  return {
    segment,
    items: withText(items),
    addons: withText(addons),
    unavailable: failsText(unavailable.filter((u) => requested.has(u.productId) || [...needs].some((n) => NEEDS[n]?.products.includes(u.productId)))),
    lockedByGstin: failsText(locked),
    linkOptions,
    term: items.some((i) => productById[i.productId].minContract > 12) ? 24 : 12,
  };
}
