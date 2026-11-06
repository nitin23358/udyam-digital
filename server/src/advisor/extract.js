// Rule-based understanding of what the owner typed (English, Hindi and Hinglish).
// Used on its own when no LLM key is configured, and as a safety net merged with LLM output.
import { cities, businessTypes, SEGMENT_KEY } from '../data.js';

export const INTERNET = ['Mobile hotspot', 'Home broadband', 'Business broadband', 'Leased line', 'Mixed per site', 'None'];

const TYPE_RULES = [
  ['Pharmacy', /pharma(cy)?\b|chemist|medical store|medicals|dawai|dawa ?khana|दवा|फार्मेसी|केमिस्ट|मेडिकल/i],
  ['Kirana store', /kirana|grocery|general store|provision|supermarket|किराना|राशन|जनरल स्टोर/i],
  ['Salon', /salon|parlou?r|barber|beauty|spa\b|सैलून|पार्लर|ब्यूटी/i],
  ['Boutique', /boutique|tailor|clothes shop|cloth shop|कपड़े|बुटीक|साड़ी/i],
  ['Mobile repair shop', /mobile (repair|shop|store)|phone repair|मोबाइल/i],
  ['Bakery', /baker(y|s)|cake|बेकरी|केक/i],
  ['Sweet shop', /sweet|mithai|halwai|मिठाई|हलवाई/i],
  ['Hardware store', /hardware|paint shop|sanitary|हार्डवेयर/i],
  ['Optician', /optic|optician|spectacle|chashm|eyewear|चश्म/i],
  ['Stationery shop', /stationer|book ?shop|xerox|photocopy|स्टेशनरी/i],
  ['Dental clinic', /dental|dentist|डेंटल|दांत/i],
  ['Physiotherapy clinic', /physio|फिजियो/i],
  ['Diagnostic lab', /diagnostic|pathology|path lab|\blab\b|लैब|डायग्नोस्टिक/i],
  ['CA firm', /\bca\b|c\.a\.|chartered accountant|accountan|tax consult|audit firm|सीए|अकाउंटेंट/i],
  ['Law office', /\blaw\b|lawyer|advocate|legal|attorney|वकील|लॉ फर्म/i],
  ['Coaching centre', /coaching|tuition|classes|institute|कोचिंग|ट्यूशन/i],
  ['Travel agency', /travel|tours|ट्रैवल/i],
  ['Architecture studio', /architect|interior design|design studio|आर्किटेक्ट/i],
  ['Real estate agency', /real ?estate|property dealer|property agent|realty|प्रॉपर्टी/i],
  ['Insurance agency', /insurance|बीमा/i],
  ['Budget hotel group', /hotel|lodge|guest ?house|homestay|होटल|लॉज/i],
  ['Restaurant chain', /restaurant|cafe|café|dhaba|eatery|food outlet|cloud kitchen|रेस्टोरेंट|रेस्तरां|ढाबा|कैफ़े/i],
  ['Gym chain', /\bgym|fitness|जिम/i],
  ['Pre-school chain', /pre-?school|play ?school|daycare|kindergarten|प्ले स्कूल/i],
  ['Electronics retail chain', /electronics|इलेक्ट्रॉनिक्स/i],
  ['Apparel retail chain', /apparel|fashion|garment (store|shop|retail)/i],
  ['Textile unit', /textile|weaving|power ?loom|spinning|कपड़ा मिल|टेक्सटाइल/i],
  ['Auto-parts unit', /auto[- ]?(parts|component)|automotive|ऑटो पार्ट/i],
  ['Plastic moulding unit', /plastic|moulding|molding|प्लास्टिक/i],
  ['Packaging unit', /packaging|carton|corrugat|पैकेजिंग/i],
  ['Printing press', /printing|press\b|प्रिंटिंग/i],
  ['Furniture workshop', /furniture|wood ?work|carpent|फर्नीचर/i],
  ['Food processing unit', /food processing|masala|spices|pickle|namkeen factory|फूड प्रोसेसिंग/i],
];
const GENERIC_RULES = [
  ['Clinic', 'prof', /clinic|doctor|hospital|nursing home|क्लिनिक|डॉक्टर/i],
  ['Manufacturing unit', 'mfg', /factory|manufactur|workshop|plant\b|फैक्ट्री|कारखान/i],
  ['Office', 'prof', /office|consultan|agency|ऑफिस|दफ़्तर/i],
  ['Shop', 'micro', /shop|store|dukaan|dukan|दुकान/i],
];

const CHAIN_OF = { Pharmacy: 'Pharmacy chain', Bakery: 'Bakery chain', Boutique: 'Apparel retail chain', 'Mobile repair shop': 'Electronics retail chain' };

export function segmentFor(type, sites = 1, hint) {
  const segName = businessTypes[type];
  let seg = segName ? SEGMENT_KEY[segName] : hint || null;
  if (!seg) return null;
  if (seg === 'micro' && sites >= 2) seg = 'multi';
  if (seg === 'multi' && sites < 2) seg = 'micro';
  return seg;
}

export function normaliseType(type, sites = 1) {
  if (sites >= 2 && CHAIN_OF[type]) return CHAIN_OF[type];
  return type;
}

const CITY_ALIASES = {
  bangalore: 'Bengaluru', bengaluru: 'Bengaluru', bombay: 'Mumbai', 'new delhi': 'Delhi', vizag: 'Visakhapatnam',
  calcutta: 'Kolkata', madras: 'Chennai', mysore: 'Mysuru', cochin: 'Kochi', baroda: 'Vadodara', poona: 'Pune',
  'दिल्ली': 'Delhi', 'मुंबई': 'Mumbai', 'पुणे': 'Pune', 'जयपुर': 'Jaipur', 'लखनऊ': 'Lucknow', 'इंदौर': 'Indore',
  'भोपाल': 'Bhopal', 'पटना': 'Patna', 'नागपुर': 'Nagpur', 'बेंगलुरु': 'Bengaluru', 'बैंगलोर': 'Bengaluru', 'कोलकाता': 'Kolkata',
  'चेन्नई': 'Chennai', 'हैदराबाद': 'Hyderabad', 'अहमदाबाद': 'Ahmedabad', 'सूरत': 'Surat', 'वडोदरा': 'Vadodara',
  'नासिक': 'Nashik', 'लुधियाना': 'Ludhiana', 'कोच्चि': 'Kochi', 'कोयंबटूर': 'Coimbatore', 'मैसूर': 'Mysuru', 'विशाखापत्तनम': 'Visakhapatnam',
};

export function findCity(text) {
  const t = text.toLowerCase();
  for (const c of Object.keys(cities)) if (new RegExp(`\\b${c.toLowerCase()}\\b`).test(t)) return c;
  for (const [a, c] of Object.entries(CITY_ALIASES)) if (t.includes(a)) return c;
  return null;
}

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
};
const NUM = `(\\d+|${Object.keys(WORD_NUM).join('|')})`;
const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : WORD_NUM[s.toLowerCase()] ?? WORD_NUM[s]);

const EMP_WORDS = 'staff|employees?|people|persons?|workers?|members?|team|ppl|log|लोग|कर्मचारी|स्टाफ|लोगों';
const SITE_WORDS = 'branch(?:es)?|outlets?|stores?|shops?|locations?|sites?|units?|clinics?|centres?|centers?|restaurants?|hotels?|gyms?|schools?|factories|plants?|शाखा(?:एं|एँ|ओं)?|दुकानें|आउटलेट|ब्रांच';

export const NEED_RULES = {
  cctv: /cctv|camera|surveillance|कैमरा|सीसीटीवी/i,
  payments: /\bupi\b|card|\bpos\b|billing|bills?\b|payment|invoice|checkout|भुगतान|बिलिंग|पेमेंट/i,
  whatsapp: /whats ?app|व्हाट्स/i,
  sms: /\bsms\b|text message|एसएमएस/i,
  email: /e-?mail|gmail|office suite|google workspace|microsoft 365|ईमेल|मेल/i,
  backup: /backup|back up|storage|cloud storage|files|records|बैकअप/i,
  security: /virus|ransomware|antivirus|malware|hack|cyber|data security|patient data|firewall|सुरक्षा|वायरस/i,
  calls: /\bivr\b|phone line|telephony|reception|call cent|calls? from customers|landline|कॉल/i,
  tollfree: /toll ?free|1800|टोल फ्री/i,
  website: /website|web ?site|domain|online presence|वेबसाइट/i,
  uptime: /never (goes|go) down|keeps? going down|outage|downtime|failover|backup internet|reliable|uptime|internet (goes|keeps) (off|down)|इंटरनेट बंद/i,
  guestwifi: /guest wi-?fi|customer wi-?fi|free wi-?fi|wi-?fi for (customers|guests|students|members)|ग्राहकों के लिए वाई/i,
  remote: /static ip|remote access|\bserver\b|vpn/i,
  central: /central(ly)? manag|manage all|sd-?wan|all (branches|outlets|sites) from one/i,
  machines: /machine|iot|sensor|energy (use|monitor)|मशीन/i,
  fleet: /fleet|vehicle|truck|delivery (bikes|vans)|\bgps\b|गाड़ि/i,
};

const PRODUCT_RULES = [
  ['P06', /100 ?mbps leased|leased line 100/i],
  ['P05', /leased ?line|dedicated (internet|line|bandwidth)|\bill\b|लीज़्ड लाइन/i],
  ['P03', /\b1 ?g(bps)?\b|gigabit|1000 ?mbps/i],
  ['P02', /300 ?mbps/i],
  ['P04', /air ?fiber|5g (broadband|wifi|fwa)|wireless broadband/i],
  ['P10', /sd-?wan/i],
  ['P11', /static ip/i],
  ['P13', /toll ?free|1800/i],
  ['P21', /firewall/i],
  ['P15', /whats ?app (business )?api/i],
];

export const GSTIN_RE = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/i;
export const UDYAM_RE = /UDYAM-[A-Z]{2}-\d{2}-\d{7}/i;

export function extractRules(text, expecting) {
  const out = { needs: [], requested: [] };
  const t = String(text || '').trim();
  if (!t) return out;

  for (const [type, re] of TYPE_RULES) if (re.test(t)) { out.businessType = type; break; }
  if (!out.businessType) for (const [type, seg, re] of GENERIC_RULES) if (re.test(t)) { out.businessType = type; out.segmentHint = seg; break; }

  const city = findCity(t);
  if (city) out.city = city;

  const emp = t.match(new RegExp(`${NUM}\\s*(?:\\+\\s*)?(?:${EMP_WORDS})`, 'i')) || t.match(new RegExp(`(?:team of|staff of|employ)\\s*${NUM}`, 'i'));
  if (emp) out.employees = toNum(emp[1]);
  if (/just me|only me|alone|sirf main|akela|अकेल|सिर्फ़ मैं|सिर्फ मैं/i.test(t)) out.employees = 1;
  const site = t.match(new RegExp(`${NUM}\\s*(?:${SITE_WORDS})`, 'i'));
  if (site && !(emp && site.index === emp.index)) out.sites = toNum(site[1]);

  if (/different (isp|provider)|mixed|each (site|outlet|branch)|multiple (isp|provider)|हर लोकेशन/i.test(t) && expecting === 'currentInternet') out.currentInternet = 'Mixed per site';
  else if (/hotspot|mobile data|phone (data|internet)|हॉटस्पॉट/i.test(t)) out.currentInternet = 'Mobile hotspot';
  else if (/business broadband/i.test(t)) out.currentInternet = 'Business broadband';
  else if (/leased line/i.test(t) && /(use|have|current|already)/i.test(t)) out.currentInternet = 'Leased line';
  else if (/home (broadband|wifi|wi-fi|internet)|broadband|wifi|wi-fi|ब्रॉडबैंड|वाईफाई/i.test(t) && expecting === 'currentInternet') out.currentInternet = 'Home broadband';
  else if (/(no|without|nothing|none|koi nahi|कोई नहीं|नहीं है).{0,12}(internet)?/i.test(t) && expecting === 'currentInternet') out.currentInternet = 'None';

  for (const [need, re] of Object.entries(NEED_RULES)) {
    if (need === 'security' && /security camera/i.test(t) && !/virus|ransom|hack|cyber|data/i.test(t)) continue;
    if (re.test(t)) out.needs.push(need);
  }
  for (const [id, re] of PRODUCT_RULES) if (re.test(t)) { out.requested.push(id); if (id === 'P06') break; }
  if (out.requested.includes('P06')) out.requested = out.requested.filter((x) => x !== 'P05');

  const g = t.toUpperCase().match(GSTIN_RE);
  if (g) { out.gstin = g[0]; out.hasGstin = true; }
  else if (/no gst|without gst|not registered|gst nahi|जीएसटी नहीं|GST नहीं|don'?t have (a )?gst/i.test(t)) out.hasGstin = false;
  const u = t.toUpperCase().match(UDYAM_RE);
  if (u) out.udyam = u[0];

  // Bare answers to the question we just asked.
  const bare = t.match(new RegExp(`^${NUM}\\+?$`, 'i'));
  if (bare && expecting === 'employees') out.employees = toNum(bare[1]);
  if (bare && expecting === 'sites') out.sites = toNum(bare[1]);
  if (expecting === 'city' && !out.city && /^[\p{L} .'-]{2,40}$/u.test(t)) out.city = t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (expecting === 'businessType' && !out.businessType && t.length <= 60) out.businessType = t.replace(/^(i (run|have|own) (a|an)?|a |an )/i, '').trim();

  return out;
}
