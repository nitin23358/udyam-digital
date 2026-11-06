// Cross-checks extracted document fields against each other and the MOCK registries.
// Nothing here calls a real government system — results are labelled "mock registry" in the UI.
import { gstinRegistry, udyamRegistry, DATA_TODAY } from '../data.js';
import { validateGstin, repairGstin, lookalikeCandidates, maskGstin } from './gstin.js';
import { findCity } from '../advisor/extract.js';

const norm = (s) => String(s || '').toLowerCase().replace(/\(prop\.?/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(pvt|private|ltd|limited|llp|the|and)\b/g, ' ').replace(/\s+/g, ' ').trim();
export function nameSimilarity(a, b) {
  const A = new Set(norm(a).split(' ').filter(Boolean));
  const B = new Set(norm(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.max(A.size, B.size);
}
const sameName = (a, b) => nameSimilarity(a, b) >= 0.75;
// Legal names look like "Owner Name (Prop. Trade Name)": compare both halves separately,
// otherwise a swapped business name hides behind the matching owner name.
const splitLegal = (s) => { const m = String(s || '').match(/^(.+?)\s*\(Prop\.?\s*(.+?)\)?$/i); return m ? [m[1], m[2]] : [s, null]; };
function sameLegalName(a, b) {
  const [pa, ba] = splitLegal(a); const [pb, bb] = splitLegal(b);
  if (ba || bb) return sameName(pa, pb) && sameName(ba || pa, bb || pb) && nameSimilarity(ba || '', bb || '') >= 0.99;
  return sameName(a, b);
}
const pin = (s) => (String(s || '').replace(/(\d)\s+(\d)/g, '$1$2').match(/\b\d{6}\b/) || [])[0] || null;
const proprietorOf = (legal) => (String(legal || '').match(/^(.+?)\s*\(Prop/i) || [])[1] || null;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const DOC_LABEL = {
  gst_certificate: 'GST certificate',
  udyam_certificate: 'Udyam certificate',
  signatory_id: 'Signatory ID',
  address_proof: 'Address proof',
};

export function verifyDocuments(docs, ctx = {}) {
  const checks = [];
  const add = (doc, id, status, label, detail) => checks.push({ doc, id, status, label, detail });
  const by = Object.fromEntries(docs.map((d) => [d.type, d]));
  const gst = by.gst_certificate?.fields;
  const udy = by.udyam_certificate?.fields;
  const sig = by.signatory_id?.fields;
  const addr = by.address_proof?.fields;
  const facts = {};
  let reg = null;

  // ---------- GST certificate ----------
  if (gst) {
    const shaped = gst.gstin && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(repairGstin(gst.gstin).gstin);
    const readable = shaped && (gst.legalName || gst.tradeName) && (by.gst_certificate.confidence ?? 100) >= 55;
    if (!readable) {
      add('gst_certificate', 'gst_readable', 'fail', 'Document is readable', 'The photo is too blurred to read the GSTIN and names reliably. Please retake it in good light, flat and in focus.');
    } else {
      add('gst_certificate', 'gst_readable', 'pass', 'Document is readable', `OCR confidence ${Math.round(by.gst_certificate.confidence ?? 0)}%`);
      // Format + checksum, with OCR look-alike repair.
      let v = validateGstin(gst.gstin);
      let note = '';
      if (!v.valid) {
        const r = repairGstin(gst.gstin);
        const v2 = validateGstin(r.gstin);
        if (v2.valid) { v = v2; note = ' (fixed common OCR look-alike characters)'; }
        else {
          const c = lookalikeCandidates(r.gstin).find((x) => gstinRegistry.has(x));
          if (c) { v = validateGstin(c); note = ' (fixed an OCR look-alike character)'; }
          else v = { ...v2, gstin: r.gstin };
        }
      }
      facts.gstin = v.gstin;
      if (!v.valid) {
        // Help the reviewer: is there a registry record with the same name + address?
        const near = [...gstinRegistry.values()].find((r) => sameName(r.trade_name, gst.tradeName) && pin(r.principal_place_of_business) === pin(gst.address));
        add('gst_certificate', 'gstin_format', 'fail', 'GSTIN format and check digit',
          `${maskGstin(v.gstin)} fails the GSTIN check-digit test — the number printed on the certificate is wrong.${near ? ` The registry has ${near.trade_name} at the same address under ${maskGstin(near.gstin)}.` : ''}`);
      } else {
        add('gst_certificate', 'gstin_format', 'pass', 'GSTIN format and check digit', `Valid structure, state code ${v.gstin.slice(0, 2)} (${v.state})${note}`);
        reg = gstinRegistry.get(v.gstin);
        if (!reg) add('gst_certificate', 'gstin_registry', 'fail', 'Found in GST registry (mock)', 'No registration with this GSTIN exists in the registry.');
        else {
          const ok = reg.status === 'Active';
          add('gst_certificate', 'gstin_registry', ok ? 'pass' : 'fail', 'Registration is active (mock registry)',
            ok ? `Active since ${reg.registration_date}` : `Registry status is ${reg.status.toUpperCase()}. Services that need a GSTIN can't be activated on a ${reg.status.toLowerCase()} registration.`);
          const legalOk = sameLegalName(reg.legal_name, gst.legalName);
          const tradeOk = sameName(reg.trade_name, gst.tradeName);
          add('gst_certificate', 'gst_names', legalOk && tradeOk ? 'pass' : 'fail', 'Names match the registry',
            legalOk && tradeOk ? `${reg.trade_name}` : `Certificate says “${!legalOk ? gst.legalName : gst.tradeName}” but the registry has “${!legalOk ? reg.legal_name : reg.trade_name}”. The certificate may have been altered.`);
          const addrOk = pin(reg.principal_place_of_business) === pin(gst.address);
          add('gst_certificate', 'gst_address', addrOk ? 'pass' : 'warn', 'Address matches the registry', addrOk ? reg.principal_place_of_business : 'Address on the certificate differs from the registry record.');
          facts.legalName = reg.legal_name; facts.tradeName = reg.trade_name; facts.constitution = reg.constitution;
          facts.address = reg.principal_place_of_business; facts.status = reg.status; facts.state = reg.state;
        }
        if (ctx.gstin && ctx.gstin !== v.gstin) add('gst_certificate', 'gst_matches_entered', 'fail', 'Matches the GSTIN you entered', `You entered ${maskGstin(ctx.gstin)} but the certificate shows ${maskGstin(v.gstin)}.`);
      }
      facts.legalName ||= gst.legalName; facts.tradeName ||= gst.tradeName; facts.constitution ||= gst.constitution; facts.address ||= gst.address;
    }
  }

  // ---------- Udyam certificate ----------
  if (udy) {
    if (!udy.udyamNumber) {
      add('udyam_certificate', 'udyam_number', 'fail', 'Udyam number present', 'The registration number field on the certificate is blank. Please upload the complete certificate (download it again from the Udyam portal).');
    } else {
      const u = udyamRegistry.get(udy.udyamNumber);
      if (!u) add('udyam_certificate', 'udyam_registry', 'fail', 'Found in Udyam registry (mock)', `${udy.udyamNumber} is not in the registry.`);
      else {
        add('udyam_certificate', 'udyam_registry', 'pass', 'Found in Udyam registry (mock)', `${u.enterprise_type} enterprise · ${u.nic_description}`);
        const nameOk = sameName(u.enterprise_name, udy.enterpriseName);
        add('udyam_certificate', 'udyam_name', nameOk ? 'pass' : 'fail', 'Enterprise name matches', nameOk ? u.enterprise_name : `Certificate says “${udy.enterpriseName}”, registry has “${u.enterprise_name}”.`);
        const placeOk = norm(u.state) === norm(udy.state) && norm(u.city) === norm(udy.city);
        add('udyam_certificate', 'udyam_place', placeOk ? 'pass' : 'warn', 'City and state match', placeOk ? `${u.city}, ${u.state}` : `Certificate: ${udy.city}, ${udy.state} · Registry: ${u.city}, ${u.state}`);
        facts.udyamType = u.enterprise_type;
        facts.businessType = u.nic_description;
      }
    }
    const biz = facts.tradeName || ctx.businessName;
    if (biz && udy.enterpriseName && !sameName(biz, udy.enterpriseName) && !sameName(facts.legalName, udy.enterpriseName)) {
      add('udyam_certificate', 'udyam_cross', 'fail', 'Same business as GST certificate', `Udyam is for “${udy.enterpriseName}”, GST is for “${biz}”.`);
    }
  }

  // ---------- Signatory ID ----------
  if (sig) {
    if (!sig.name) add('signatory_id', 'sig_readable', 'fail', 'ID is readable', 'Could not read the name on the ID. Please retake the photo.');
    else {
      const valid = sig.validTill && sig.validTill >= DATA_TODAY;
      add('signatory_id', 'sig_valid', valid ? 'pass' : 'fail', 'ID has not expired', valid ? `Valid till ${sig.validTill}` : `Expired on ${sig.validTill || 'unknown date'}`);
      const biz = facts.tradeName || ctx.businessName;
      if (biz) {
        const ok = sameName(sig.business, biz) || sameName(sig.business, facts.legalName);
        add('signatory_id', 'sig_business', ok ? 'pass' : 'fail', 'Issued for this business', ok ? sig.business : `ID is for “${sig.business}”, not “${biz}”.`);
      }
      const prop = proprietorOf(facts.legalName);
      if (prop) {
        const ok = sameName(prop, sig.name);
        add('signatory_id', 'sig_authority', ok ? 'pass' : 'fail', 'Signatory is the proprietor', ok ? `${sig.name} is the registered proprietor` : `GST registry lists ${prop} as proprietor, but the ID is for ${sig.name}.`);
      } else if (ctx.applicantName) {
        const ok = sameName(ctx.applicantName, sig.name);
        add('signatory_id', 'sig_authority', ok ? 'pass' : 'fail', 'Signatory matches the applicant',
          ok ? `${sig.name} (${sig.designation || 'signatory'})` : `The application is by ${ctx.applicantName}, but the signatory ID is for ${sig.name}. For a ${String(facts.constitution || 'company').toLowerCase()}, upload an authorisation letter or apply as the named signatory.`);
      } else {
        add('signatory_id', 'sig_authority', 'warn', 'Signing authority', `Registry can't confirm who signs for a ${String(facts.constitution || 'company').toLowerCase()}; we'll confirm with ${sig.name} via e-sign OTP.`);
      }
      facts.signatory = sig.name;
    }
  }

  // ---------- Address proof ----------
  if (addr) {
    if (!addr.billDate) add('address_proof', 'addr_readable', 'fail', 'Bill is readable', 'Could not read the bill date. Please retake the photo.');
    else {
      const age = daysBetween(addr.billDate, DATA_TODAY);
      const ok = age >= 0 && age <= 90;
      add('address_proof', 'addr_recent', ok ? 'pass' : 'fail', 'Bill is less than 90 days old', ok ? `Dated ${addr.billDate} (${age} days ago)` : `Dated ${addr.billDate} — ${age} days old. Please upload a bill from the last 3 months.`);
    }
    const biz = facts.tradeName || ctx.businessName;
    if (biz && addr.billedTo) {
      const ok = sameName(addr.billedTo, biz) || sameName(addr.billedTo, facts.legalName);
      add('address_proof', 'addr_name', ok ? 'pass' : 'warn', 'Billed to this business', ok ? addr.billedTo : `Bill is in the name of “${addr.billedTo}”.`);
    }
    if (facts.address && addr.address) {
      const ok = pin(facts.address) === pin(addr.address);
      add('address_proof', 'addr_match', ok ? 'pass' : 'fail', 'Same address as GST registration', ok ? `PIN ${pin(addr.address)}` : `Bill address (PIN ${pin(addr.address) || '?'}) differs from GST address (PIN ${pin(facts.address) || '?'}).`);
    }
    facts.installAddress = addr.address || facts.address;
  }

  // Missing required documents.
  const required = ['signatory_id', 'address_proof', ctx.hasGstin === false ? 'udyam_certificate' : 'gst_certificate'];
  const missing = required.filter((r) => !by[r]);

  const docStatus = {};
  for (const d of docs) {
    const cs = checks.filter((c) => c.doc === d.type);
    docStatus[d.type] = cs.some((c) => c.status === 'fail') ? 'fail' : cs.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  }
  const fails = checks.filter((c) => c.status === 'fail').length;
  const city = findCity(facts.address || '') || null;
  return {
    status: missing.length ? 'incomplete' : fails ? 'needs_attention' : 'verified',
    missing: missing.map((m) => ({ type: m, label: DOC_LABEL[m] })),
    checks,
    docStatus,
    facts: { ...facts, city, gstinMasked: facts.gstin ? maskGstin(facts.gstin) : null },
    checkedAt: new Date().toISOString(),
    source: 'Mock registries supplied with the hackathon dataset — not a live GSTN/Udyam check',
  };
}

export { DOC_LABEL };
