// GSTIN structure: 2-digit state code + 10-char PAN + entity no. + 'Z' + checksum.
// The checksum is the standard GSTN mod-36 algorithm, so we can do a real format check offline.
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const STATE_CODES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export function gstChecksum(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    if (v < 0) return null;
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

// Pattern per position. PAN 4th char (index 5) is the entity type; the dataset always uses 'X', which we accept.
const PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function validateGstin(raw) {
  const g = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const errors = [];
  if (g.length !== 15) errors.push(`GSTIN should have 15 characters, found ${g.length}`);
  else {
    if (!PATTERN.test(g)) errors.push('GSTIN characters are not in the expected pattern');
    if (!STATE_CODES[g.slice(0, 2)]) errors.push(`State code ${g.slice(0, 2)} is not a valid Indian state code`);
    const c = gstChecksum(g.slice(0, 14));
    if (c && c !== g[14]) errors.push('Check digit does not match - the number may be mistyped');
  }
  return { gstin: g, valid: errors.length === 0, errors, state: STATE_CODES[g.slice(0, 2)] || null };
}

// OCR commonly swaps look-alike characters. Coerce each position to its expected class,
// then, if the checksum still fails, try single-character look-alike swaps that make it pass.
const TO_DIGIT = { O: '0', D: '0', Q: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6', A: '4' };
const TO_ALPHA = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 8: 'B', 6: 'G', 4: 'A', 7: 'Z' };
const LOOKALIKE = { I: ['J', 'L', '1'], J: ['I'], L: ['I'], O: ['0', 'D', 'Q'], '0': ['O', 'D'], '7': ['Z', '1'], Z: ['7', '2'], '1': ['I', '7', 'L'], S: ['5'], '5': ['S'], B: ['8'], '8': ['B'], U: ['V'], V: ['U'], M: ['N'], N: ['M'], E: ['F'], F: ['E'], K: ['X'], X: ['K'] };
const cls = (i) => (i < 2 || (i >= 7 && i <= 10) ? 'd' : (i >= 2 && i <= 6) || i === 11 ? 'a' : i === 13 ? 'z' : 'x');

export function repairGstin(raw) {
  let s = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length !== 15) return { gstin: s, corrected: false, changes: 0 };
  const chars = s.split('');
  let changes = 0;
  chars.forEach((ch, i) => {
    const k = cls(i);
    let n = ch;
    if (k === 'd' && !/[0-9]/.test(ch)) n = TO_DIGIT[ch] ?? ch;
    if (k === 'a' && !/[A-Z]/.test(ch)) n = TO_ALPHA[ch] ?? ch;
    if (k === 'z') n = 'Z';
    if (n !== ch) { chars[i] = n; changes++; }
  });
  s = chars.join('');
  return { gstin: s, corrected: changes > 0, changes };
}

// Candidates differing by one look-alike character that have a valid checksum.
export function lookalikeCandidates(g) {
  const out = [];
  for (let i = 0; i < g.length; i++) {
    for (const alt of LOOKALIKE[g[i]] || []) {
      const c = g.slice(0, i) + alt + g.slice(i + 1);
      if (validateGstin(c).valid) out.push(c);
    }
  }
  return out;
}

export function maskGstin(g) {
  if (!g || g.length < 15) return g;
  return g.slice(0, 2) + g.slice(2, 4) + '•••••••' + g.slice(11);
}
